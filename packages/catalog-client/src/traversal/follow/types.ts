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

import { Entity } from '@backstage/catalog-model';
import { TraverseCatalogNode } from '../types';

/**
 * An edge follower that is visited for each node during the traversal, and
 * decides which other nodes to visit (forming edges as it goes).
 */
export interface TraverseCatalogFollower<
  TEntity extends Entity = Entity,
  TEdgeData = unknown,
> {
  visitNode(options: {
    node: TraverseCatalogNode<TEntity>;
    edgeData?: TEdgeData;
    visit(options: { entityRef: string; edgeData?: TEdgeData }): void;
  }): Promise<void>;
}

/**
 * The set of standard edge followers given to the
 * {@link TraverseCatalogFollowerFactory}.
 */
export interface TraverseCatalogFollowerFactoryContext {
  relations<
    TEntity extends Entity = Entity,
    TEdgeData extends {} = {},
  >(options: {
    match?: (candidate: { type: string; kind?: string }) => boolean;
  }): TraverseCatalogFollower<TEntity, TEdgeData & { relationType: string }>;
}

/**
 * A factory function that returns an edge follower. The context contains
 * helpers for easily constructing common followers.
 */
export type TraverseCatalogFollowerFactory<
  TEntity extends Entity,
  TEdgeData = unknown,
> = (
  context: TraverseCatalogFollowerFactoryContext,
) => TraverseCatalogFollower<TEntity, TEdgeData>;
