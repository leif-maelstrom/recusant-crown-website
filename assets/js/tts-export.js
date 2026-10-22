// Tabletop Simulator export: turns a deck into a TTS "saved object" file.
//
// The card images are the shared set sheets made by tools/make-tts-sheets.js
// (listed in tts-sheets.js), so no deck needs images of its own: the file
// just says which slot of which sheet each card is. Players put the file in
//   Documents/My Games/Tabletop Simulator/Saves/Saved Objects
// and spawn it from Objects > Saved Objects in the game.
(function () {
  var SITE = 'https://www.recusantcrown.com/';

  // Tabletop Simulator fetches the images itself, so they need full public
  // addresses: this site's own when it is served over https (a fan's copy
  // included), else the main site.
  function base() {
    if (location.protocol === 'https:') return location.origin + location.pathname.replace(/[^/]*$/, '');
    return SITE;
  }

  function guid() {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  function transform(y) {
    return { posX: 0, posY: y, posZ: 0, rotX: 0, rotY: 180, rotZ: 180, scaleX: 1, scaleY: 1, scaleZ: 1 };
  }

  // entries: [{ qty, card }]. Returns { text, missing } where missing lists
  // cards that are not on the sheets yet (added since they were made).
  function build(name, entries) {
    var tts = window.RC_TTS;
    if (!tts) throw new Error('The Tabletop Simulator sheets are not available.');
    var root = base();
    var customDecks = {};
    var ids = [], contained = [], missing = [];

    entries.forEach(function (e) {
      var spot = tts.cards[e.card.number];
      if (!spot || spot[2] !== e.card.name) { missing.push(e.card.name); return; }
      var key = String(spot[0] + 1);
      if (!customDecks[key]) {
        customDecks[key] = {
          FaceURL: root + tts.sheets[spot[0]],
          BackURL: root + tts.back,
          NumWidth: tts.cols,
          NumHeight: tts.rows,
          BackIsHidden: true,
          UniqueBack: false,
          Type: 0
        };
      }
      var id = (spot[0] + 1) * 100 + spot[1];
      for (var i = 0; i < e.qty; i++) {
        ids.push(id);
        var one = {};
        one[key] = customDecks[key];
        contained.push({
          Name: 'Card', Nickname: e.card.name, Description: '', CardID: id,
          Transform: transform(1), CustomDeck: one, GUID: guid()
        });
      }
    });

    var object = contained.length === 1 ? contained[0] : {
      Name: 'DeckCustom',
      Transform: transform(1),
      Nickname: name,
      Description: 'Recusant Crown deck (' + tts.set + ')',
      ColorDiffuse: { r: 0.713, g: 0.713, b: 0.713 },
      Locked: false, Grid: true, Snap: true, Autoraise: true, Sticky: true,
      Tooltip: true, GridProjection: false, Hands: false, SidewaysCard: false,
      DeckIDs: ids,
      CustomDeck: customDecks,
      ContainedObjects: contained,
      GUID: guid()
    };
    object.Nickname = name;

    var save = {
      SaveName: '', GameMode: '', Date: '', Table: '', Sky: '', Note: '', Rules: '',
      XmlUI: '', LuaScript: '', LuaScriptState: '',
      ObjectStates: [object]
    };
    return { text: JSON.stringify(save, null, 2), missing: missing, count: ids.length };
  }

  window.RC_TTS_EXPORT = { build: build };
})();
