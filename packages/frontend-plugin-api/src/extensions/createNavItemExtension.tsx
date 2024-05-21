/*
 * Copyright 2023 The Backstage Authors
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

import { IconComponent } from '@backstage/core-plugin-api';
import { createSchemaFromZod } from '../schema/createSchemaFromZod';
import {
  createExtension,
  createExtensionDataRef,
  createExtensionInput,
} from '../wiring';
import { ExternalRouteRef, RouteRef } from '../routing';

/**
 * Helper for creating extensions for a nav item.
 * @public
 */
export function createNavItemExtension(options: {
  type?: 'drawer' | 'dropdown' | 'collapse';
  namespace?: string;
  name?: string;
  attachTo?: { id: string; input: string };
  disabled?: boolean;
  routeRef: RouteRef<undefined> | ExternalRouteRef<undefined>;
  title: string;
  subtitle?: string;
  icon: IconComponent;
  secondaryAction?: (props: {
    active: boolean;
    toggle: () => void;
  }) => JSX.Element;
  featureFlag?: string;
}) {
  const {
    type,
    icon,
    title,
    subtitle,
    name,
    namespace,
    secondaryAction,
    featureFlag,
    routeRef,
    attachTo,
    disabled,
  } = options;
  return createExtension({
    namespace,
    name,
    disabled,
    kind: 'nav-item',
    attachTo: attachTo ?? { id: 'app/nav', input: 'items' },
    configSchema: createSchemaFromZod(z =>
      z.object({
        title: z.string().default(title),
        subtitle: z.string().default(subtitle ?? ''),
      }),
    ),
    inputs: {
      items: createExtensionInput({
        target: createNavItemExtension.targetDataRef.optional(),
      }),
    },
    output: {
      navTarget: createNavItemExtension.targetDataRef,
    },
    factory: ({ config }) => {
      return {
        navTarget: {
          to: routeRef,
          title: config.title,
          subtitle: config.subtitle,
          type,
          icon,
          secondaryAction,
          featureFlag,
        },
      };
    },
  });
}

/** @public */
export namespace createNavItemExtension {
  // TODO(Rugvip): Should this be broken apart into separate refs? title/icon/routeRef
  export const targetDataRef = createExtensionDataRef<
    | {
        title: string;
        subtitle?: string;
        icon: IconComponent;
        to: string | RouteRef<undefined> | ExternalRouteRef<undefined>;
        featureFlag?: string;
      }
    | {
        title: string;
        subtitle?: string;
        icon: IconComponent;
        secondaryAction: (props: {
          active: boolean;
          toggle: () => void;
        }) => JSX.Element;
        featureFlag?: string;
      }
    | {
        type: 'drawer' | 'dropdown' | 'collapse';
        title: string;
        subtitle?: string;
        icon: IconComponent;
        featureFlag?: string;
      }
  >('core.nav-item.target');
}
