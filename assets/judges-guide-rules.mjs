/* Verbatim text of every penalty rule in the VEKN Judges' Guide that the
 * vademecum can cite. Stored locally so the modal opens instantly and works
 * fully offline — the original deep-link via Text Fragments was unreliable
 * (Firefox doesn't support `#:~:text=`, and Safari/Chrome occasionally fail
 * to scroll to the heading). The data is the canonical English text from
 * https://www.vekn.net/judges-guide; emphasis is kept as **bold** markers
 * so the renderer can format Penalty/Philosophy headings consistently.
 *
 * If the VEKN regulation is amended, update this file and bump the SW
 * VERSION so judges receive the new copy.
 */

/**
 * @typedef {{
 *   heading: string,
 *   intro: string,
 *   examples?: string[],
 *   philosophy?: string,
 *   penalty: string,
 * }} JudgesGuideRule
 */

/** @type {Record<number, JudgesGuideRule>} */
export const JUDGES_GUIDE_RULE_TEXTS = {
  101: {
    heading: "101. Deck Problem - Illegal Decklist",
    intro:
      "This penalty applies to tournaments in which decklists are being used.\n\n" +
      "Players are considered to have an illegal decklist when one of the following conditions is true:\n" +
      "- The decklist contains an illegal number of cards.\n" +
      "- The decklist contains cards that are illegal for the format.",
    examples: [
      "A player in a Constructed tournament has 58 cards listed on his decklist when the minimum is 60.",
      "A player in any tournament lists Madness of the Bard (a banned card) on his decklist.",
    ],
    philosophy:
      "The decklist is the ultimate guide to a player's deck. If the decklist lists an illegal deck, the player is playing with an illegal deck, regardless of the actual contents of his or her deck. However, it is not in the best interest of the event to disqualify players for illegal decklists.",
    penalty:
      "**Warning**. The general philosophy is to correct a player's decklist so it is legal, and let the player continue playing. The head judge should correct the decklist to reflect the actual contents of the deck (if the main deck itself is legal). If the main deck is illegal both with the decklist and the physical main deck, the penalty is **Game loss**, and the head judge should allow the player five minutes to make the decklist legal and ensure the main deck matches the corrected decklist.",
  },
  102: {
    heading: "102. Deck Problem - Illegal Main Deck (Legal Decklist)",
    intro:
      "This penalty applies to tournaments in which decklists are being used. This penalty applies to players who have misplaced cards from their deck or have cards from a previous game in their deck.\n\n" +
      "Players are considered to have an illegal deck when one of the following conditions is true (while the decklist still indicates a legal deck):\n" +
      "- The main deck contains an illegal number of cards.\n" +
      "- The main deck contains cards that are illegal for the format.\n" +
      "- The contents of the main deck do not match the decklist.",
    philosophy:
      "The decklist is the ultimate guide to a player's deck. If the decklist indicates a legal deck, but the actual contents of the deck do not match the decklist, the player should restore the deck to reflect the decklist. If the judge can determine with complete confidence that the deck/decklist discrepancy is due to an error on the decklist (a player is using an all Gangrel deck and has Campground Hunting Ground listed on the decklist instead of Zoo Hunting Ground), he or she may decide to fix the decklist instead. A warning should be issued in this case.",
    penalty:
      "**Game loss**, and then be instructed to make any changes necessary to make the contents of the deck match what is recorded on the decklist. The changes must be complete before the next round begins for the player to continue in the tournament.",
  },
  103: {
    heading: "103. Deck Problem - Illegal Main Deck (No Decklist Used)",
    intro:
      "This penalty applies to tournaments in which decklists are not being used.\n\n" +
      "Players are considered to have an illegal main deck when one of the following conditions is true:\n" +
      "- The main deck contains an illegal number of cards.\n" +
      "- The main deck contains cards that are illegal for the format.",
    examples: [
      "A player in a constructed tournament has 58 cards in his deck when the minimum is 60.",
      "A player in any tournament has Madness of the Bard (a banned card) in his deck.",
    ],
    philosophy:
      "If the deck contains an illegal selection of cards in some manner, the player is playing with an illegal deck. However, it is not in the best interest of the event to disqualify players for illegal decks.",
    penalty:
      "**Game loss**. Judges and other tournament officials must be vigilant about reminding players before the tournament begins of the consequences of playing with an illegal deck.\n\n" +
      "When decklists are not being used, the general philosophy is to correct a player's deck and allow the player to continue playing in subsequent rounds. The head judge should work with the player to correct the deck. All illegal cards should be removed immediately. If cards need to be added to make the deck legal, the judge should require the player add only simple cards like Master Discipline cards and Forced Awakening, etc. — not specific counter cards like Gangrel Atavism, for example. If cards need to be removed to make the deck legal, then random cards should be removed in order to make the deck legal.",
  },
  111: {
    heading: "111. Procedural Error - Minor",
    intro:
      "A Minor Procedural Error occurs when a player performs an unintentional, slightly disruptive action at the tournament.",
    examples: [
      "A player fails to provide a reliable method to track her pool totals.",
      "A player shuffles his deck after an opponent has cut it.",
      "A player repeatedly holds her cards below the table.",
    ],
    philosophy:
      "Procedural errors vary significantly. The judge should adjust the penalty appropriately to reflect the level of tournament disruption.",
    penalty:
      "**Caution**. If the procedural error makes it impossible for a player to effectively continue the game, then upgrade the penalty to **game loss** as needed.",
  },
  112: {
    heading: "112. Procedural Error - Major",
    intro:
      "A Major Procedural Error occurs when a player performs an unintentional, disruptive action at the tournament.",
    examples: [
      "A player replaces cards in his sealed deck with copies of the same card without permission from a judge.",
      "A player does not sufficiently randomize her deck before presenting it to her opponent.",
    ],
    philosophy:
      "Procedural errors vary significantly. The judge should adjust the penalty appropriately to reflect the level of tournament disruption.",
    penalty:
      "**Warning**. If the procedural error makes it impossible for a player to effectively continue the game, then upgrade the penalty to **game loss** as needed.",
  },
  113: {
    heading: "113. Procedural Error - Severe",
    intro:
      "A Severe Procedural Error occurs when a player performs an unintentional, extremely disruptive action at the tournament.",
    examples: ["A player spills his drink on his deck and is unable to continue the game effectively."],
    philosophy:
      "Procedural errors vary significantly and the judge should adjust the penalty appropriately to reflect the level of tournament disruption.",
    penalty: "**Game loss**.",
  },
  114: {
    heading: "114. Procedural Error - Misrepresentation",
    intro:
      "A player is considered to have committed this infraction when he or she unintentionally misplayed a card or a game rule.",
    examples: [
      "A player attempts to play Dread Gaze on a referendum that one of his vampires called.",
      "A player attempts to play Frenzy during his own turn.",
      "A player plays Art Museum when she doesn't have any ready Toreador.",
    ],
    philosophy:
      "This penalty assumes an unintentional action on behalf of the player. If the judge believes the misrepresentation was intentional, see section 160 — Cheating.",
    penalty: "**Caution**.",
  },
  121: {
    heading: "121. Card Drawing - Drawing Extra Cards",
    intro:
      "Players are not considered to have drawn extra cards when they place a card face down on the table (without looking at the card) in an effort to accurately count out cards as they draw. This penalty should be applied only once to one or more cards if they are drawn in the same action or sequence of actions, at the judge's discretion.",
    philosophy:
      "Any time players draw extra cards, there is always a chance they will go unnoticed by their opponent, potentially giving them a significant advantage. Because of this potential for abuse, the penalty for drawing extra cards is fairly severe. A player can accidentally look at extra cards very easily, so a separate, less severe penalty is established for that infraction called Looking at Extra Cards (section 122).\n\n" +
      "Correcting the problem always involves putting the extra card (if known, or a random card from the player's hand if not known) back in the deck and reshuffling the deck, unless some other player has, through the course of the game, gained a knowledge of some portion of the player's deck, in which case the card should simply be returned to the top of the deck without shuffling. This ensures that the game will be impacted as little as possible.\n\n" +
      "Improper Drawing at Start of Game (section 123) is also a separate, less severe penalty.",
    penalty:
      '**Warning**. For the game to continue, the situation should always be corrected. When it is obvious which extra card was drawn, the card should be placed back in the deck. If it is unclear which card is the "extra" card, a random card should be selected from a player\'s hand. The opponents of the player committing the infraction should be allowed to see any cards the other player has seen due to this infraction.\n\n' +
      "An automatic **game loss** should be applied if a player has drawn so many cards that a judge is unable to correct the situation.",
  },
  122: {
    heading: "122. Card Drawing - Looking at Extra Cards",
    intro:
      "This could include dropping cards on the floor, turning a card over while shuffling an opponent's deck, or revealing cards from their deck in the act of misplaying a card. This penalty also applies when a player has looked at a card in an opponent's deck or hand in the course of a game (such as turning over an extra card while resolving a random discard effect).\n\n" +
      "A player is not considered to have looked at extra cards when he or she places a card face down on the table (without looking at the card) in an effort to count out cards he or she will draw.\n\n" +
      "This penalty should be applied only once to one or more cards if they are seen in the same action or sequence of actions.",
    examples: [
      "A player accidentally flips over a card while shuffling her opponent's deck.",
      "A player flips over an extra card while drawing from his deck.",
      "A player looks at the bottom card of his deck when presenting it to his predator for cutting/shuffling.",
    ],
    philosophy:
      "A player can accidentally look at extra cards very easily so the penalty is less severe than Drawing Extra Cards. Drawing Extra Cards is a separate, more severe penalty because of the increased potential for abuse. The card seen should be shuffled back into the deck or placed on top of the deck as appropriate (see 121) if it was the top card of the deck that was seen, or returned to the area where it came from otherwise.",
    penalty:
      "**Caution**. In addition to the appropriate penalty, the situation should always be corrected.\n\n" +
      "An automatic **game loss** should be applied if a player has seen so many cards that a judge is unable to correct the situation or has received too much of an advantage by seeing an extra card (for example, the player sees the next card which reveals some crucial, strategic information).",
  },
  123: {
    heading: "123. Card Drawing - Improper Drawing at Start of Game",
    intro:
      "Players committing this infraction draw an extra card (or too few cards) when they draw their hand or uncontrolled region cards.",
    philosophy:
      "This is generally a minor infraction and deserves a fairly minor penalty. Forcing players to redraw their hands with one less card is fairly quick and simple and avoids the possibility of a player gaining an advantage if he or she just had to reshuffle his or her cards and draw a new hand.",
    penalty:
      "The player must shuffle his or her hand into the deck and redraw the opening hand, drawing one less card than the number he or she should have drawn — not the number he or she actually drew. His or her hand size should be restored to the normal amount after every player has taken a turn. If the error was in drawing too many crypt cards for the uncontrolled region (and looking at them), the reduced draw (of three uncontrolled vampires) is corrected by drawing the fourth vampire from the crypt after every player has taken a turn.",
  },
  124: {
    heading: "124. Card Drawing - Failure to Draw",
    intro: "A player does not draw a card that he or she was required to draw.",
    philosophy: "This is generally a minor infraction and deserves a fairly minor penalty.",
    penalty: "**Caution**. Players must correct the situation by drawing back up to their hand size.",
  },
  131: {
    heading: "131. Marked Cards - No Pattern",
    intro:
      "A player's cards are marked with no pattern to the types of cards that are marked. If a player is using opaque sleeves, they are taken into consideration instead of the actual cards. If a player is using clear sleeves, both the card and sleeve are taken into consideration.",
    examples: [
      "A player in a tournament has small marks on a few of his sleeves. The markings are on an Ascendence, a Dodge, and a Scouting Mission. The judge decides this is not a significant pattern.",
    ],
    philosophy: "The possibility for advantage is fairly low when there is no pattern to the markings.",
    penalty: "**Caution**.",
  },
  132: {
    heading: "132. Marked Cards - Observable Pattern",
    intro:
      "A player's cards are marked with a pattern to the types of cards that are marked. If a player is using opaque sleeves, they are taken into consideration instead of the actual cards. If a player is using clear sleeves, both the card and sleeve are taken into consideration.",
    examples: [
      "A player in a tournament has Jyhad-backed reaction cards in an otherwise all V:TES-backed library.",
      "A player in a tournament has four Kiss of Ra in her deck, all of which are in card sleeves that have a slight bend in one corner.",
    ],
    philosophy:
      "The potential for advantage is high when there is a pattern to the markings. Therefore the penalty must be significant. Please note this penalty still assumes that the cards are marked unintentionally. Refer to section 160 — Cheating, if the judge believes that the cards were marked intentionally.",
    penalty: "**Game loss**.",
  },
  141: {
    heading: "141. Slow Play - Playing Slowly",
    intro:
      "Players who take longer than is reasonably required to complete game actions are engaged in slow play. If a judge believes that a player is intentionally playing slowly to take advantage of a time limit, that player is guilty of Stalling (section 162).",
    examples: ["A player is unsure of with which minion to block, and spends five minutes trying to decide."],
    philosophy:
      "Slow Play penalties do not require a judge to determine whether a player is intentionally stalling. All players have the responsibility to play quickly enough so their opponent is not at a significant disadvantage because of the time limit. A judge should take into consideration the tournament scores when deciding if this should be upgraded to a Stalling penalty.",
    penalty:
      "**Caution**. In addition to the penalty, the judge may assign extra time to the game if he or she feels it is appropriate. The option to add extra time should be used sparingly in order to avoid tournament delays.",
  },
  142: {
    heading: "142. Slow Play - Exceeding Pre-Game Time Limit",
    intro: "A player exceeds the time limit for completing his or her pre-game steps.",
    examples: ["After three minutes into a round, the player has not completed his shuffling."],
    philosophy:
      "This penalty assumes the player is not intentionally stalling. If the head judge believes it is intentional, refer to section 160 — Cheating, instead.",
    penalty: "**Caution**. A one-minute time extension is included with the penalty.",
  },
  151: {
    heading: "151. Unsportsmanlike Conduct - Minor",
    intro:
      "Minor Unsportsmanlike Conduct is defined as behavior that may be disruptive to a person at the tournament, but has no significant impact on the operation of the tournament in any way.",
    examples: [
      "A player uses inappropriate language.",
      "A player loudly demands to a judge that her opponent receive a penalty.",
    ],
    philosophy:
      "Different levels of Unsportsmanlike conduct should be penalized accordingly. The head judge is always the final authority on what constitutes Unsportsmanlike conduct and is free to interpret the guidelines as he or she sees fit for the appropriate situation.",
    penalty: "**Warning**.",
  },
  152: {
    heading: "152. Unsportsmanlike Conduct - Major",
    intro:
      "Major Unsportsmanlike Conduct is defined as behavior that is disruptive to a player or players at the tournament, but does not cause delays or include any form of physical contact or significant emotional distress.",
    examples: [
      "A player repeatedly calls a judge and argues that an opponent should lose the game for insignificant procedural oversights.",
      "A player fails to obey the instructions of a tournament official.",
      "A player refuses to play a game.",
    ],
    philosophy:
      "Different levels of Unsportsmanlike conduct should be penalized accordingly. The head judge is always the final authority on what constitutes Unsportsmanlike conduct and is free to interpret the guidelines as he or she sees fit for the appropriate situation.",
    penalty: "**Game loss**.",
  },
  153: {
    heading: "153. Unsportsmanlike Conduct - Severe",
    intro:
      "Severe Unsportsmanlike Conduct is defined as behavior that is disruptive to a player or players at a tournament, causes delays, and may include any form of physical contact or significant emotional distress.",
    examples: [
      "A player pulls a chair from beneath another player, causing her to fall to the ground with a minor injury.",
      "A player argues in an excessive and belligerent manner with a judge after the judge has made a final ruling.",
    ],
    philosophy:
      "Different levels of Unsportsmanlike conduct should be penalized accordingly. The head judge is always the final authority on what constitutes Unsportsmanlike conduct and is free to interpret the guidelines as he or she sees fit for the appropriate situation.",
    penalty: "**Disqualification without Prize**.",
  },
  161: {
    heading: "161. Cheating - Bribery",
    intro:
      "A player attempts to bribe an opponent into changing the results of a game by offering inducements outside of the current game.",
    examples: ["A player offers an opponent cash or cards to throw a game."],
    philosophy:
      "Players in the finals of a tournament should not be considered in violation of this rule as long as they meet the following criteria:\n" +
      "- No player introduces incentives outside the current game such as cash, cards, prizes, or other items. (For example, an offer to split the prizes would not be acceptable.)\n" +
      "- All players involved in all affected games agree on the outcome.",
    penalty: "**Disqualification without Prize**.",
  },
  162: {
    heading: "162. Cheating - Stalling",
    intro:
      "A player intentionally plays slowly in order to take advantage of the time limit. Refer to section 141 for unintentional slow play.",
    examples: [
      'A player has no options available to significantly affect the game, and spends several minutes "thinking" about what to do.',
      "A player whose library is known to have no more equipment in it takes actions via Vast Wealth to use the remaining time in the round searching and shuffling the library for the purpose of preventing his opponent from getting another turn.",
    ],
    philosophy:
      'If it is clear that a player is stalling, he or she should face a serious penalty. A player need not be playing slowly to be guilty of stalling. If the player is just performing idle activity for no purpose other than to take advantage of a time limit, this can also be considered stalling (e.g. using Vast Wealth on every turn even when no more equipment can be found just to spend time "searching" the library and shuffling it.) In addition to issuing any appropriate penalties to the stalling player, the judge may add an appropriate amount of time to the round to compensate for time lost due to stalling. The time added should not be more than the approximate amount of time lost due to the stalling violation. Any time added to the round must be immediately announced.',
    penalty: "**Game loss**.",
  },
  163: {
    heading: "163. Cheating - Fraud",
    intro:
      "A player intentionally misrepresents rules, procedures, personal information, or any other relevant tournament information.",
    examples: ["A player uses a fake name and V:EKN number when registering for a tournament."],
    philosophy: "There should be zero tolerance for this type of activity.",
    penalty: "**Disqualification without Prize**.",
  },
  164: {
    heading: "164. Cheating - Collusion",
    intro: "Players agree to alter, predetermine, or otherwise illegally establish the results of a game.",
    examples: [
      "A player agrees to let his friend oust him without offering resistance in order to improve the friend's standings in the event.",
      "With two players remaining, each agree to flip a coin to determine which player will concede the game.",
    ],
    philosophy:
      "Players participating in standard table talk or in-game agreements should not be considered in violation of this rule as long as they meet the following criteria:\n" +
      "- No player introduces incentives outside the current game such as cash, cards, or other items.\n" +
      "- No part of the agreement has been secret or has taken place outside of the current game.\n" +
      "- No part of the agreement involves a random selection of the winner.\n" +
      "- The agreement does not otherwise violate section 5.2 of the V:EKN Tournament Rules.",
    penalty: "**Disqualification without Prize**.",
  },
};
