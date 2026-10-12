import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

/** The card format — one constant for the validation and for the API documentation. */
export const CARD_CODE_PATTERN = /^[A-Z0-9-]{1,32}$/;

/**
 * POST /entries body. Only the card format reaches the database: upper-case letters, digits
 * and '-', at most 32 characters (the column). Anything else is a 400 from ValidationPipe —
 * no 500 on a too-long INSERT, no HTML stored and shown to the front desk.
 */
export class EnterDto {
  @ApiProperty({
    description: 'Kód karty ze čtečky. Mezery na okrajích se oříznou.',
    example: 'CARD-001',
    pattern: CARD_CODE_PATTERN.source,
    maxLength: 32,
  })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(CARD_CODE_PATTERN, { message: 'cardCode musí být 1–32 znaků A–Z, 0–9 nebo -' })
  cardCode!: string;
}

/** GET /entries?limit=… — a whole number 1–100, otherwise 400. LIMIT -5 never reaches SQL. */
export class ListQueryDto {
  @ApiPropertyOptional({
    type: 'integer',
    description: 'Kolik posledních průchodů vrátit.',
    minimum: 1,
    maximum: 100,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
}
