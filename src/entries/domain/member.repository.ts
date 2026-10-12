import { Member } from './member.entity';

/**
 * What the domain needs: "find a member by card". Who answers it (MySQL, memory, a file)
 * is decided in the module. An abstract class, not an interface, so Nest can use it as the
 * injection token — TypeScript interfaces do not exist at runtime.
 */
export abstract class MemberRepository {
  abstract findByCardCode(cardCode: string): Promise<Member | null>;
}
