/*
 * Copyright 2024 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Entity, stringifyEntityRef } from '@backstage/catalog-model';
import DataLoader from 'dataloader';
import { CatalogApi, EntityFieldsQuery } from '../types';
import { CollectorFactoryContextImpl } from './collect/CollectorFactoryContextImpl';
import {
  TraverseCatalogCollector,
  TraverseCatalogCollectorFactory,
} from './collect/types';
import { FollowerFactoryContextImpl } from './follow/FollowerFactoryContextImpl';
import { TraverseCatalogFollowerFactory } from './follow/types';
import { TraverseCatalogInitialSet, TraverseCatalogNode } from './types';

type InternalNode<TEntity extends Entity, TEdgeData> = {
  node: TraverseCatalogNode<TEntity>;
  edgeData?: TEdgeData;
};

/**
 * Makes a traversal through the catalog, starting from an initial set and
 * following along edges to other entities.
 */
export async function traverseCatalog<
  TEdgeData,
  TEntity extends Entity = Entity,
  TResult = void,
>(options: {
  catalogApi: CatalogApi;
  fields?: EntityFieldsQuery;
  initial: TraverseCatalogInitialSet;
  follow: TraverseCatalogFollowerFactory<TEntity, TEdgeData>;
  collect: TraverseCatalogCollectorFactory<TResult, TEntity, TEdgeData>;
}): Promise<TResult> {
  // Default is to get full entities, but if a fields restriction was passed in,
  // we want to ensure that the absolute bare minimum is included to be able to
  // form entity refs out of them and to follow relations
  const fields = options.fields?.length
    ? Array.from(
        new Set([
          'kind',
          'relations',
          'metadata.name',
          'metadata.namespace',
          ...options.fields,
        ]),
      )
    : undefined;
  const follow = options.follow(new FollowerFactoryContextImpl());
  const collect = options.collect(new CollectorFactoryContextImpl());

  // Batching loader that will serve entities where needed for the traversal.
  const loader = new DataLoader<string, TEntity | undefined>(
    async (entityRefs: readonly string[]) => {
      const { items } = await options.catalogApi.getEntitiesByRefs({
        entityRefs: entityRefs as string[],
        fields,
      });
      return items as TEntity[];
    },
    {
      name: 'traverseCatalog',
      maxBatchSize: 100,
      batchScheduleFn: cb => setTimeout(cb, 5),
    },
  );

  const visitedNodes = new Set<string>();
  const nextLayer = new Array<InternalNode<TEntity, TEdgeData>>();

  function makeNode(
    entityRef: string,
    depth: number,
    edgeData?: TEdgeData,
  ): InternalNode<TEntity, TEdgeData> {
    return {
      node: {
        depth,
        entityRef,
        entity: () => loader.load(entityRef),
      },
      edgeData,
    };
  }

  // Make sure to push the initial items
  if ('entityRef' in options.initial) {
    nextLayer.push(makeNode(options.initial.entityRef, 0));
  } else if ('entityRefs' in options.initial) {
    for (const entityRef of options.initial.entityRefs) {
      nextLayer.push(makeNode(entityRef, 0));
    }
  } else {
    const { items: entities } = await options.catalogApi.getEntities({
      filter: options.initial.filter,
      fields,
    });
    for (const entity of entities) {
      const entityRef = stringifyEntityRef(entity);
      loader.prime(entityRef, entity as TEntity); // prime loader cache so it doesn't have to be fetched again
      nextLayer.push(makeNode(entityRef, 0));
    }
  }

  // Keep working until there are no more layers to process
  while (nextLayer.length) {
    // Clear out the current layer and analyze all of its nodes in parallel
    const currentLayer = nextLayer.splice(0, nextLayer.length);
    await Promise.all(
      currentLayer.map(async current => {
        if (visitedNodes.has(current.node.entityRef)) {
          return;
        }

        visitedNodes.add(current.node.entityRef);
        await collect.visitNode?.({
          node: current.node,
          edgeData: current.edgeData,
        });

        await follow.visitNode({
          node: current.node,
          edgeData: current.edgeData,
          visit(next) {
            nextLayer.push(
              makeNode(next.entityRef, current.node.depth + 1, next.edgeData),
            );
          },
        });

        for (const next of nextLayer) {
          await collect.visitEdge?.({
            previousNode: current.node,
            currentNode: next.node,
            edgeData: next.edgeData,
          });
        }
      }),
    );
  }

  return collect.complete();
}

const collect: TraverseCatalogCollectorFactory<
  Entity[],
  Entity,
  { relationType: number }
> = () => ({
  visitEdge(options) {},
  complete() {
    return [];
  },
});

const array = await traverseCatalog({
  catalogApi: null as unknown as CatalogApi,
  initial: { entityRef: 'user:default/test' },
  follow: c => c.relations({}),
  // collect: c => c.toEntityRefArray({ minDepth: 1 }),
  collect: collect,
});
