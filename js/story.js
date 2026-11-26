/* =================================================================
   GESCHICHTE: Einträge schalten sich frei, sobald die Bedingung erfüllt ist, und bleiben dauerhaft in der Chronik.
   ================================================================= */
const STORY_CHAPTERS = [
    "I · Der Bettler von Eichenfurt",
    "II · Das Rudel von Erlenbach",
    "III · Der verlassene Tempel",
    "IV · Die drei Siegel",
    "V · Nebelmoor",
    "VI · Kaltgrat",
    "VII · Aschenruinen",
    "VIII · Die Chronik der Ahnen",
    "IX · Neue Seiten"
];

// ch: Index in STORY_CHAPTERS | when: Bedingung (wird laufend geprüft)
const STORY_CONFIG = [
    // I
    { id: "start", ch: 0, title: "Ein Morgen ohne Brot", when: () => true,
      text: "Du erwachst am Dorfbrunnen von Eichenfurt. Die Taschen sind leer, der Magen knurrt. Irgendwo muss man anfangen, und wer nichts besitzt, fängt mit der ausgestreckten Hand an." },
    { id: "firstCoin", ch: 0, title: "Die erste Münze", when: () => state.resources.money.current > 0 || state.unlocked.length > 0,
      text: "Eine halbe Münze, geworfen von jemandem, der es eilig hatte. Es ist wenig, aber es ist ein Anfang. Im Dorfladen liegt eine Schürze, die genau zu deinem Geldbeutel passt." },
    { id: "apron", ch: 0, title: "Die Küchenschürze", when: () => (state.inventory.apron || 0) > 0,
      text: "Die Schürze riecht nach Rauch und Brot. Die Köchin der Schänke wirft dir einen Lappen zu und sagt nur: Wer arbeiten will, ist hier willkommen." },
    { id: "knife", ch: 0, title: "Das Messer der Köchin", when: () => gearCount("kitchenKnife") > 0,
      text: "Nach einigen Tagen in der Küche drückt dir die Köchin ein altes Messer in die Hand. Es ist zu scharf für Gemüse und zu stumpf für ein Schwert. Sie nickt zum Waldrand: Dort gibt es Wild." },
    { id: "hunt", ch: 0, title: "Der erste Hase", when: () => usesOf("hunt") >= 1,
      text: "Der erste Hase ist schneller als erwartet, aber du bist hungriger. Zum ersten Mal seit Wochen ist dein Magen still." },
    { id: "house", ch: 0, title: "Das verlassene Haus", when: () => !!state.flags.houseFame,
      text: "Am Dorfrand steht ein Haus, in dem seit Jahren niemand wohnt. Du findest Vorräte, Geschichten und Spuren der Bewohner. Im Dorf spricht man bald darüber, dass der Bettler sich etwas traut." },
    // II
    { id: "combat", ch: 1, title: "Ein Name im Dorf", when: () => !!state.flags.combatUnlocked,
      text: "Dein Name geht von Mund zu Mund. Hinter der Schmiede liegt ein alter Trainingsraum. Die Holzpuppe dort schlägt nicht zurück, aber sie lehrt dich trotzdem etwas." },
    { id: "lodge", ch: 1, title: "Die Jagdhütte", when: () => usesOf("hunt") >= 20,
      text: "Die Jäger erzählen von einem roten Fuchs, der ihre Fallen leert und die Hühner stiehlt. Die Jagdhütte am Bach ist sein Revier. Wer ihn erlegt, bekommt von den Jägern Respekt und ein Ei, das noch warm ist." },
    { id: "fox", ch: 1, title: "Der Fuchs von Erlenbach", when: () => winsOf("lodge") >= 1,
      text: "Der Fuchs war klug, du warst hartnäckig. Die Jäger klopfen dir auf die Schulter, und im Dorf ist man nun überzeugt, dass du kein Bettler mehr bist." },
    { id: "elder", ch: 1, title: "Dorfvorsteher Harwin", when: () => usesOf("elder") >= 1,
      text: "Harwin, der Dorfvorsteher, bittet dich zu sich. Er ist alt, streng und hört gut zu. Er will wissen, was du kannst, und er hat Aufgaben, für die man Vertrauen braucht." },
    { id: "patrol", ch: 1, title: "Die Patrouille", when: () => usesOf("elder") >= 5,
      text: "Harwin vertraut dir die Runde durchs Dorf an. Wer nachts Wache hält, wird gesehen, und wer gesehen wird, wird erinnert. So wächst Ruhm: langsam, Schritt für Schritt." },
    { id: "cave", ch: 1, title: "Heulen aus der Höhle", when: () => !!state.flags.caveFound,
      text: "Bei einer deiner Runden hörst du es: ein tiefes Heulen aus einer Felsspalte hinter dem Dorf. Die Wolfshöhle. Die Dörfler meiden den Weg, seit die Schafe verschwinden." },
    { id: "wolf", ch: 1, title: "Der Wolf", when: () => winsOf("cave") >= 1,
      text: "Der Wolf liegt besiegt vor dir. Sein Pelz glänzt wie Silber. Im Dorf wird gefeiert, und Harwin lässt dich rufen. Er hat noch eine Geschichte, die er nur dem Besten erzählen wollte." },
    // III
    { id: "mission", ch: 2, title: "Harwins Auftrag", when: () => usesOf("elderMission") >= 1,
      text: "Harwin erzählt vom verlassenen Tempel im Wald. Niemand hat ihn je gesehen, aber die Alten schwören, dass er existiert. Er bittet dich, danach zu suchen." },
    { id: "forest", ch: 2, title: "Im Wald", when: () => usesOf("forest") >= 1,
      text: "Der Wald ist dichter, als du ihn in Erinnerung hast. Zwischen Kräutern und Totholz suchst du nach Spuren eines Weges, der seit Generationen nicht begangen wurde." },
    { id: "templeFound", ch: 2, title: "Der Tempel", when: () => usesOf("forest") >= 5,
      text: "Zwischen Efeu und Moos erhebt sich eine Mauer, zu gerade für die Natur. Der Tempel ist real. Du kehrst zu Harwin zurück, um zu berichten." },
    { id: "templeReport", ch: 2, title: "Harwins Dank", when: () => usesOf("reportTemple") >= 1,
      text: "Harwin lächelt zum ersten Mal. Er verspricht, im Dorf von dir zu sprechen. Deine Legende darf wachsen, und mit ihr dein Ruhm." },
    { id: "entrance", ch: 2, title: "Der verschlossene Eingang", when: () => usesOf("temple") >= 5,
      text: "Nach vielen Tagen findest du ihn: einen Eingang aus schwarzem Stein, glatt wie Glas. Du drückst, ziehst, rufst. Nichts. Die Tür schweigt, als wüsste sie etwas, das du noch nicht weißt." },
    // IV
    { id: "chronik", ch: 3, title: "Die Chronik", when: () => !!state.flags.chronikOpen,
      text: "Harwin schließt die Tür seiner Stube. Der Tempel, sagt er, wird von drei Siegelsteinen verschlossen, die von drei Wächtern gehütet werden: im Nebelmoor, im Kaltgrat und in den Aschenruinen. Und er zeigt dir ein Buch, die Chronik des Dorfes. Wer seine Legende hineinschreibt, kann eine neue Seite aufschlagen und mit der Kraft seines Ruhms von vorn beginnen. Das Buch wird ihn nicht vergessen." },
    // V
    { id: "moorStart", ch: 4, title: "Auf ins Moor", when: () => usesOf("mission1") >= 1,
      text: "Das Nebelmoor liegt westlich von Eichenfurt, ein Land aus Wasser, Schilf und Irrlichtern. Harwin gibt dir ein Stück Kreide mit, um Wege zu markieren. Die Dörfler sagen, wer hier die Orientierung verliert, findet sie nie wieder." },
    { id: "moorFound", ch: 4, title: "Morwens Versteck", when: () => usesOf("explore1") >= 8,
      text: "Hinter einem Vorhang aus Nebel steht eine Hütte auf Stelzen. Aus dem Schornstein steigt grüner Rauch. Hier lebt Morwen, die Hexe, die den Siegelstein hütet." },
    { id: "moorBoss", ch: 4, title: "Der Siegelstein des Moores", when: () => winsOf("boss1") >= 1,
      text: "Morwen fällt, und der Nebel lichtet sich. Der Siegelstein in deiner Hand ist kalt und schwer, und er summt leise wie ein Bienenstock. Der erste von dreien." },
    { id: "moorReport", ch: 4, title: "Lob vom Dorf", when: () => usesOf("report1") >= 1,
      text: "Harwin legt den Stein in eine Truhe und liest den Namen des Moores in der Chronik. Dein Ruhm darf weiter wachsen. Im Norden, sagt er, wartet das Gebirge." },
    // VI
    { id: "mountStart", ch: 5, title: "Der Weg nach Norden", when: () => usesOf("mission2") >= 1,
      text: "Der Kaltgrat ragt wie ein Zahn aus der Landschaft. Händler berichten von Lawinen und von einem Riesen, der Eis in den Bergen sammelt. Du packst Wolle, Seile und Proviant." },
    { id: "mountFound", ch: 5, title: "Die Höhle des Riesen", when: () => usesOf("explore2") >= 8,
      text: "Eisige Winde heulen durch eine Höhle, groß wie ein Bauernhof. Der Boden zittert unter schweren Schritten. Hrungnir, der Frostriese, hat dich gewittert." },
    { id: "mountBoss", ch: 5, title: "Der Siegelstein des Gebirges", when: () => winsOf("boss2") >= 1,
      text: "Der Riese stürzt wie ein gefällter Baum. In seiner Hand liegt der zweite Stein, blau wie gefrorenes Wasser. Die Berge werden still." },
    { id: "mountReport", ch: 5, title: "Ein Name in der Chronik", when: () => usesOf("report2") >= 1,
      text: "Harwin zeichnet eine zweite Linie in die Chronik. Du spürst, dass das Buch dich kennt. Im Süden warten die Aschenruinen, die letzte Station." },
    // VII
    { id: "ashStart", ch: 6, title: "Die tote Stadt", when: () => usesOf("mission3") >= 1,
      text: "Im Süden liegt eine Stadt, die vor langer Zeit in einer einzigen Nacht verbrannte. Der Wind trägt Asche, und die Straßen knirschen unter deinen Füßen. Jemand beobachtet dich." },
    { id: "ashFound", ch: 6, title: "Der Ritter ohne Gesicht", when: () => usesOf("explore3") >= 8,
      text: "Zwischen verkohlten Säulen steht ein Ritter in schwarzer Rüstung, regungslos. Valdric, so sagen die Alten, bewacht seit Jahrhunderten den letzten Stein und hat vergessen, wen oder was er beschützt." },
    { id: "ashBoss", ch: 6, title: "Der Siegelstein der Ruinen", when: () => winsOf("boss3") >= 1,
      text: "Als Valdric fällt, bricht die Rüstung zusammen. Darunter ist nichts, nur Glut. Der dritte Stein liegt warm in deiner Hand und pulsiert im Takt deines Herzens." },
    { id: "ashReport", ch: 6, title: "Alle drei Siegel", when: () => usesOf("report3") >= 1,
      text: "Drei Steine liegen vor Harwin auf dem Tisch. Er nimmt sie wie ein Mann, der lange auf diesen Tag gewartet hat. Der Tempel ruft." },
    // VIII
    { id: "gate", ch: 7, title: "Die Pforte", when: () => usesOf("openTemple") >= 1,
      text: "Die drei Steine passen in die Mulden der Tür. Ein tiefer Ton, dann öffnet sich der Eingang. Dahinter: ein Saal voller Bücher, Staub und Stille. In der Mitte steht ein Wächter, der nur eine Aufgabe kennt." },
    { id: "finale", ch: 7, title: "Der Wächter der Chronik", when: () => winsOf("finale") >= 1,
      text: "Der Wächter zerfällt zu Staub. Auf dem Altar liegt ein Buch, aufgeschlagen auf einer leeren Seite. Es ist die Chronik, und sie trägt deinen Namen. Du erkennst: Jede Seite, die du füllst, ist eine Geschichte, die nicht vergeht. Du kannst eine neue aufschlagen." },
    // IX
    { id: "page2", ch: 8, title: "Die zweite Seite", when: () => state.meta.pages >= 1,
      text: "Du schlägst eine neue Seite auf. Eichenfurt gleicht sich wie ein Spiegelbild, doch du erinnerst dich. Die Wächter sind stärker geworden, und du bist es auch." },
    { id: "page4", ch: 8, title: "Die vierte Seite", when: () => state.meta.pages >= 3,
      text: "Die Dörfler grüßen dich mit Namen, bevor du etwas sagst. Harwins Stimme klingt anders, wenn er mit dir spricht: wie ein Chronist, der seine Lieblingsgeschichte vorliest." },
    { id: "page8", ch: 8, title: "Die achte Seite", when: () => state.meta.pages >= 7,
      text: "Du bist keine Figur in der Chronik mehr. Du bist die Hand, die sie schreibt. Eichenfurt, das Moor, das Gebirge und die Asche gehören dir, und die Geschichte kennt kein Ende." }
];

function storyCheck() {
    let any = false;
    for (const e of STORY_CONFIG) {
        if (state.story[e.id]) continue;
        let ok = false;
        try { ok = !!e.when(); } catch (err) { ok = false; }
        if (!ok) continue;
        state.story[e.id] = true;
        any = true;
        if (e.id !== "start") { showToast(`Chronik: ${e.title}`); notifyChronikTab(); }
    }
    return any;
}

function notifyChronikTab() {
    if (ui.chronikTab && currentTab !== 'chronik') ui.chronikTab.classList.add('glow');
}
