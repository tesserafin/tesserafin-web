export interface SectionOptions {
    enableOverflow: boolean;
}

export type SectionContainerElement = {
    fetchData: () => Promise<BaseItemDtoQueryResult | BaseItemDto[]>;
    getItemsHtml: (items: BaseItemDto[]) => void;
    parentContainer: HTMLElement;
} & Element;
import type { BaseItemDto } from 'lib/tesserafin-sdk/generated/models/base-item-dto';
import type { BaseItemDtoQueryResult } from 'lib/tesserafin-sdk/generated/models/base-item-dto-query-result';
