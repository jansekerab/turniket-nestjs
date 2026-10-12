import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CallerOnly } from '../../auth/api-key.guard';
import { EntriesService } from '../application/entries.service';
import { EnterDto, ListQueryDto } from './entries.dto';
import { EntryListItemResponse, EntryOutcomeResponse } from './entries.responses';

/** HTTP only. Input is already validated by the DTOs, the caller by ApiKeyGuard. */
@ApiTags('průchody')
@ApiSecurity('api-key')
@ApiUnauthorizedResponse({ description: 'Chybí klíč, nebo je to klíč jiného volajícího.' })
@ApiTooManyRequestsResponse({ description: 'Víc než 10 požadavků za sekundu z jedné adresy.' })
@Controller('entries')
export class EntriesController {
  constructor(private readonly entries: EntriesService) {}

  @Post()
  @HttpCode(200)
  @CallerOnly('reader')
  @ApiOperation({
    summary: 'Pokus o průchod turniketem (klíč čtečky)',
    description:
      'Ověří kartu, u platného člena otevře turniket a pokus **vždy zapíše** — i když zařízení selže. ' +
      'Odmítnutí je odpověď 200 se stavem denied_*, ne chyba.',
  })
  @ApiOkResponse({ type: EntryOutcomeResponse })
  @ApiBadRequestResponse({ description: 'Kód karty chybí, nemá formát, nebo tělo obsahuje jiné pole.' })
  enter(@Body() body: EnterDto) {
    return this.entries.enter(body.cardCode);
  }

  @Get()
  @CallerOnly('staff')
  @ApiOperation({ summary: 'Poslední průchody pro recepci (klíč recepce)' })
  @ApiOkResponse({ type: [EntryListItemResponse] })
  @ApiBadRequestResponse({ description: 'limit není celé číslo 1–100.' })
  list(@Query() query: ListQueryDto) {
    return this.entries.last(query.limit);
  }
}
