import { ApiProperty } from '@nestjs/swagger';
import { EntryListItem } from '../application/entry-list.query';
import { EntryOutcome } from '../application/entry-outcome';
import { ENTRY_STATUSES, type EntryStatus } from '../domain/entry.entity';

/*
 * Response shapes for the API documentation. Each class `implements` the application type,
 * so the compiler refuses a documented field that the service does not return (or vice versa).
 */

export class EntryOutcomeResponse implements EntryOutcome {
  @ApiProperty({ enum: ENTRY_STATUSES, description: 'Jak pokus o průchod skončil.' })
  status!: EntryStatus;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Jan Platný',
    description: 'Jméno člena; null u neznámé karty.',
  })
  member!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'členství skončilo 2025-01-31',
    description: 'Důvod pro recepci. Při otevření null.',
  })
  detail!: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 28,
    description: 'Jak dlouho trvalo zařízení (ms); null, když se nevolalo.',
  })
  deviceMs!: number | null;
}

export class EntryListItemResponse implements EntryListItem {
  @ApiProperty({ example: 5 })
  id!: number;

  @ApiProperty({ example: '*****001', description: 'Kód karty zamaskovaný — celý kód otevírá turniket.' })
  cardCodeMasked!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Jan Platný' })
  fullName!: string | null;

  @ApiProperty({ enum: ENTRY_STATUSES })
  status!: EntryStatus;

  @ApiProperty({ type: String, nullable: true })
  detail!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  deviceMs!: number | null;

  @ApiProperty({ example: '2026-10-01 07:08:39', description: 'Čas zápisu v UTC.' })
  createdAt!: string;
}
