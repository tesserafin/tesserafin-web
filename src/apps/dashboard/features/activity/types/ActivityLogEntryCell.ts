import type { ActivityLogEntry } from 'lib/tesserafin-sdk';
import type { MRT_Cell, MRT_Row } from 'material-react-table';

export interface ActivityLogEntryCell {
    cell: MRT_Cell<ActivityLogEntry>;
    row: MRT_Row<ActivityLogEntry>;
}
