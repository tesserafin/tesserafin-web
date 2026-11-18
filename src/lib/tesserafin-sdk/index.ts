/**
 * Barrel for the generated Reefin API client (src/lib/tesserafin-sdk/generated/, produced by
 * `npm run generate:tesserafin-sdk` - see README.md in this directory) PLUS the hand-written
 * construction wrapper in `./client` (`TesserafinSdk`/`TesserafinApi`/`createTesserafinApi`), which mirrors
 * `@jellyfin/sdk`'s own `Jellyfin`/`Api`/`createApi` shape (see `node_modules/@jellyfin/sdk/lib/
 * jellyfin.js`, `api.js`) so migrating a call site is a construction-point swap, not a rewrite -
 * see docs/tesserafin/design-tesserafin-api-layer.md §3/§4.1.
 */
export * from './generated';
export * from './client';
export * from './imageUrl';

import type { TesserafinApi } from './client';
import { AuthenticationApi } from './generated/api/authentication-api';
import { DeviceApi } from './generated/api/device-api';
import { BackupApi } from './generated/api/backup-api';
import { BrandingApi } from './generated/api/branding-api';
import { ChannelApi } from './generated/api/channel-api';
import { GenreApi } from './generated/api/genre-api';
import { ImageApi } from './generated/api/image-api';
import { LibraryApi } from './generated/api/library-api';
import { LibraryStructureApi } from './generated/api/library-structure-api';
import { LiveTvApi } from './generated/api/live-tv-api';
import { LocalizationApi } from './generated/api/localization-api';
import { MovieApi } from './generated/api/movie-api';
import { SessionApi } from './generated/api/session-api';
import { ScheduledTaskApi } from './generated/api/scheduled-task-api';
import { ShowApi } from './generated/api/show-api';
import { StudioApi } from './generated/api/studio-api';
import { SystemApi } from './generated/api/system-api';
import { UserApi } from './generated/api/user-api';
import { UserViewApi } from './generated/api/user-view-api';

/**
 * Per-tag generated-client convenience factories, one per `*Api` class actually consumed so far -
 * same naming/shape as `@jellyfin/sdk`'s own `get*Api(api)` helpers
 * (`node_modules/@jellyfin/sdk/lib/utils/api/system-api.js`: `new SystemApi(api.configuration,
 * undefined, api.axiosInstance)`), so a call site migrating from `@jellyfin/sdk` to `tesserafin-sdk`
 * changes its import source, not its call shape (design doc §3's "mechanical swap" claim - this is
 * what makes it true in practice). Add one of these per generated `*Api` class as a second/third
 * consumer needs it, rather than inlining `new XApi(api.configuration, ...)` at every call site.
 */
export const getSystemApi = (api: TesserafinApi): SystemApi =>
    new SystemApi(api.configuration, undefined, api.axiosInstance);

export const getLibraryApi = (api: TesserafinApi): LibraryApi =>
    new LibraryApi(api.configuration, undefined, api.axiosInstance);

export const getUserViewApi = (api: TesserafinApi): UserViewApi =>
    new UserViewApi(api.configuration, undefined, api.axiosInstance);

export const getShowApi = (api: TesserafinApi): ShowApi =>
    new ShowApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the `/library/:libraryId` Genres destination (issue #15, L15a; mounted by L15b).
 * Consumed only by `apps/modern/features/library/api/libraryDestinationQueries.ts`. That module is
 * no longer dormant, but it is reached exclusively through the `library/:libraryId` async chunk
 * (`asyncRoutes/user.ts` + `AsyncRoute.tsx`'s `lazy: () => import(...)`), so `GenreApi` still stays
 * out of `main.jellyfin.bundle.js`.
 */
export const getGenreApi = (api: TesserafinApi): GenreApi =>
    new GenreApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the Studios *filter* on Browse (issue #15, L15a) - Studios is a `studioIds` predicate on
 * the Browse query, not a destination (design §3.2), so this factory only feeds the filter's option
 * list. Same async-chunk-only reachability as `getGenreApi`.
 */
export const getStudioApi = (api: TesserafinApi): StudioApi =>
    new StudioApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the `MovieRecommendations` shelf of the Suggestions destination (issue #15, L15b). Like
 * `getGenreApi`/`getStudioApi` it is consumed only by
 * `apps/modern/features/library/api/libraryDestinationQueries.ts`, which lives entirely inside the
 * `library/:libraryId` async chunk — so `MovieApi` stays out of `main.jellyfin.bundle.js`.
 */
export const getMovieApi = (api: TesserafinApi): MovieApi =>
    new MovieApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard API keys feature (`apps/dashboard/features/keys/api/`, consolidation step
 * 3). Reached only through the dashboard's async route chunks.
 */
export const getAuthenticationApi = (api: TesserafinApi): AuthenticationApi =>
    new AuthenticationApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard devices and sessions features (`apps/dashboard/features/devices/`,
 * `apps/dashboard/features/sessions/`, consolidation step 3). Reached only through the dashboard's
 * async route chunks.
 */
export const getDeviceApi = (api: TesserafinApi): DeviceApi =>
    new DeviceApi(api.configuration, undefined, api.axiosInstance);

export const getSessionApi = (api: TesserafinApi): SessionApi =>
    new SessionApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard scheduled tasks feature (`apps/dashboard/features/tasks/`, consolidation
 * step 3). Reached only through the dashboard's async route chunks.
 */
export const getScheduledTaskApi = (api: TesserafinApi): ScheduledTaskApi =>
    new ScheduledTaskApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard users feature (`apps/dashboard/features/users/`, consolidation step 3).
 * Reached only through the dashboard's async route chunks.
 */
export const getUserApi = (api: TesserafinApi): UserApi =>
    new UserApi(api.configuration, undefined, api.axiosInstance);

export const getChannelApi = (api: TesserafinApi): ChannelApi =>
    new ChannelApi(api.configuration, undefined, api.axiosInstance);

export const getLocalizationApi = (api: TesserafinApi): LocalizationApi =>
    new LocalizationApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard libraries feature (`apps/dashboard/features/libraries/`, consolidation
 * step 3). Reached only through the dashboard's async route chunks.
 */
export const getLibraryStructureApi = (
    api: TesserafinApi
): LibraryStructureApi =>
    new LibraryStructureApi(api.configuration, undefined, api.axiosInstance);

/**
 * Added for the dashboard configuration pages (backups, branding; consolidation step 3). Reached
 * only through the dashboard's async route chunks.
 */
export const getBackupApi = (api: TesserafinApi): BackupApi =>
    new BackupApi(api.configuration, undefined, api.axiosInstance);

export const getBrandingApi = (api: TesserafinApi): BrandingApi =>
    new BrandingApi(api.configuration, undefined, api.axiosInstance);

export const getImageApi = (api: TesserafinApi): ImageApi =>
    new ImageApi(api.configuration, undefined, api.axiosInstance);

export const getLiveTvApi = (api: TesserafinApi): LiveTvApi =>
    new LiveTvApi(api.configuration, undefined, api.axiosInstance);
