import { Injectable, Scope } from 'graphql-modules';
import zod from 'zod';
import { TIMELESS_DATE_REGEX } from '../../shared/constants.js';
import { getCacheInstance } from '../../shared/helpers/index.js';
import type { TimelessDateString } from '../../shared/types/index.js';

/** Israeli Corporations Authority (רשם החברות) public registry search. Public, no key; it backs
 * https://ica.justice.gov.il/GenericCorporarionInfo/SearchCorporation?unit=8 */
const REGISTRY_URL = 'https://ica.justice.gov.il/GenericCorporarionInfo/SearchGenericCorporation';
const USER_AGENT = 'accounter-server (+https://github.com/Urigo/accounter-fullstack)';
const REQUEST_TIMEOUT_MS = 15_000;
/** The registry's corporation type for companies (חברות) */
const CORPORATION_TYPE_COMPANY = '3';
const CORPORATION_NUMBER_REGEX = /^\d{9}$/;

const RegistryStringSchema = zod.string().nullish();

const RegistryCorporationSchema = zod.object({
  DisplayId: zod.string().min(1),
  DisplayName: zod.string().min(1),
  DisplayEnglishName: RegistryStringSchema,
  StatusString: RegistryStringSchema,
  DisplayCompanySubStatus: RegistryStringSchema,
  DisplayCompanyType: RegistryStringSchema,
  DisplayContactType: RegistryStringSchema,
  DisplayCompanyLimitType: RegistryStringSchema,
  DisplayCompanyPurpose: RegistryStringSchema,
  PurposeDescription: RegistryStringSchema,
  DisplayCompanyRegistrationDate: RegistryStringSchema,
  DisplayCompanyViolates: RegistryStringSchema,
  LastYearlyReport: zod.number().int().nullish(),
  IsGovernmental: zod.boolean().nullish(),
  Address: zod
    .object({
      StreetName: RegistryStringSchema,
      HouseNumber: RegistryStringSchema,
      CityName: RegistryStringSchema,
      ZipCode: zod.union([zod.number(), zod.string()]).nullish(),
      CountryName: RegistryStringSchema,
    })
    .nullish(),
});

const RegistryResponseSchema = zod.object({
  Data: zod.array(RegistryCorporationSchema).nullish(),
  Success: zod.boolean(),
});

export type IsraeliCorporationAddress = {
  street: string | null;
  houseNumber: string | null;
  city: string | null;
  zipCode: string | null;
  country: string | null;
};

export type IsraeliCorporation = {
  id: string;
  name: string;
  englishName: string | null;
  status: string | null;
  subStatus: string | null;
  corporationType: string | null;
  contactType: string | null;
  limitType: string | null;
  purpose: string | null;
  registrationDate: TimelessDateString | null;
  lastAnnualReport: number | null;
  isGovernmental: boolean;
  violations: string | null;
  address: IsraeliCorporationAddress | null;
};

/** The registry pads its values with runs of spaces (e.g. `"הדקלים              "`) */
function clean(value: string | number | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  return cleaned === '' ? null : cleaned;
}

/** `dd/MM/yyyy` → `yyyy-MM-dd` */
function parseRegistryDate(value: string | null | undefined): TimelessDateString | null {
  const match = clean(value)?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return null;
  }
  const [, day, month, year] = match;
  const date = `${year}-${month}-${day}`;
  return TIMELESS_DATE_REGEX.test(date) ? (date as TimelessDateString) : null;
}

/** Strips the spaces and dashes people type into company numbers (e.g. `51-623267-5`) */
export function normalizeCorporationNumber(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

/**
 * Parses a `SearchGenericCorporation` response.
 * Returns null when the registry has no company under `corporationNumber`, and throws when the
 * payload shape drifts, so a silent API change surfaces as an error rather than as "not found".
 */
export function parseRegistryResponse(
  json: unknown,
  corporationNumber: string,
): IsraeliCorporation | null {
  const parsed = RegistryResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`Unexpected Israeli corporations registry response: ${parsed.error.message}`);
  }
  const row = parsed.data.Data?.find(
    corporation => clean(corporation.DisplayId) === corporationNumber,
  );
  if (!parsed.data.Success || !row) {
    return null;
  }

  const address = row.Address
    ? {
        street: clean(row.Address.StreetName),
        houseNumber: clean(row.Address.HouseNumber),
        city: clean(row.Address.CityName),
        zipCode: clean(row.Address.ZipCode),
        country: clean(row.Address.CountryName),
      }
    : null;

  return {
    id: corporationNumber,
    name: clean(row.DisplayName) ?? corporationNumber,
    englishName: clean(row.DisplayEnglishName),
    status: clean(row.StatusString),
    subStatus: clean(row.DisplayCompanySubStatus),
    corporationType: clean(row.DisplayCompanyType),
    contactType: clean(row.DisplayContactType),
    limitType: clean(row.DisplayCompanyLimitType),
    purpose: clean(row.DisplayCompanyPurpose) ?? clean(row.PurposeDescription),
    registrationDate: parseRegistryDate(row.DisplayCompanyRegistrationDate),
    lastAnnualReport: row.LastYearlyReport ?? null,
    isGovernmental: row.IsGovernmental ?? false,
    violations: clean(row.DisplayCompanyViolates),
    address: address && Object.values(address).some(Boolean) ? address : null,
  };
}

@Injectable({
  scope: Scope.Singleton,
  global: true,
})
export class IsraeliCorporationsRegistryClient {
  // Misses are cached too (as null), so a form re-checking a number doesn't hit the registry again
  private cache = getCacheInstance({
    stdTTL: 60 * 60, // 1 hour
  });

  /**
   * Looks a company up by its registration number (ח.פ.).
   * Returns null when the number isn't a 9-digit company number, or the registry doesn't list it.
   */
  public async getCorporationByNumber(rawNumber: string): Promise<IsraeliCorporation | null> {
    const corporationNumber = normalizeCorporationNumber(rawNumber);
    if (!CORPORATION_NUMBER_REGEX.test(corporationNumber)) {
      // The registry answers a malformed number with an empty body
      return null;
    }

    const cached = this.cache.get<IsraeliCorporation | null>(corporationNumber);
    if (cached !== undefined) {
      return cached;
    }

    const corporation = parseRegistryResponse(
      await this.search(corporationNumber),
      corporationNumber,
    );
    this.cache.set(corporationNumber, corporation);
    return corporation;
  }

  private async search(corporationNumber: string): Promise<unknown> {
    const body = new URLSearchParams({
      corporationType: CORPORATION_TYPE_COMPANY,
      corporationNumber,
      corporationName: '',
    });

    let res: Response;
    try {
      res = await fetch(REGISTRY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
          'X-Requested-With': 'XMLHttpRequest',
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new Error(
        `Failed searching the Israeli corporations registry for ${corporationNumber}`,
        {
          cause: error,
        },
      );
    }
    if (!res.ok) {
      throw new Error(
        `Israeli corporations registry responded with ${res.status} for ${corporationNumber}`,
      );
    }
    try {
      return await res.json();
    } catch (error) {
      // e.g. a WAF block page served as HTML with status 200
      throw new Error(
        `Israeli corporations registry returned a non-JSON response for ${corporationNumber}`,
        { cause: error },
      );
    }
  }
}
