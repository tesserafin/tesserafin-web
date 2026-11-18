export const QUERY_OPTIONS = {
    limit: 100,
    fields: [
        ItemFields.PrimaryImageAspectRatio,
        ItemFields.CanDelete,
        ItemFields.MediaSourceCount
    ],
    enableTotalRecordCount: false,
    imageTypeLimit: 1
};
import { ItemFields } from 'lib/tesserafin-sdk';
