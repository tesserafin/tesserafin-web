import { type DeviceInfoDto } from 'lib/tesserafin-sdk';
import type { MRT_Row } from 'material-react-table';

export interface DeviceInfoCell {
    renderedCellValue: React.ReactNode;
    row: MRT_Row<DeviceInfoDto>;
}
