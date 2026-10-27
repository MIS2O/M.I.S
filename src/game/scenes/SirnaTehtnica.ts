import * as Phaser from 'phaser';
import { Scene } from 'phaser';
/// definicija nivojev, tipov krogov in številskih vrst
type Level = 1 | 2;
type RoundType = 'tehtnica' | 'poltrak' | 'enakovredni' | 'urejanje';
type NumKind = 'ulomek' | 'mesano' | 'decimalno' | 'naravno';

/// število shranimo kot ulomek p/q, da lahko vse vrste primerjamo med sabo
interface Num {
    kind: NumKind;
    p: number;
    q: number;
    whole: number;
    num: number;
    den: number;
}

const ROUNDS: Record<Level, RoundType[]> = {
    1: ['tehtnica', 'poltrak', 'tehtnica', 'poltrak', 'tehtnica', 'poltrak', 'tehtnica', 'poltrak'],
    2: ['enakovredni', 'tehtnica', 'poltrak', 'urejanje', 'enakovredni', 'tehtnica', 'poltrak', 'urejanje']
};

const MOUSE_HOME = { x: 60, y: 650 };

const FONT = 'Arial, sans-serif';
const COLOR_TEXT = '#3b2a14';
const COLOR_GOOD = '#1b7a1b';

export const BASIC_FRACTIONS: [number, number][] = [[1, 2], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5]];
export const REDUCIBLE_FRACTIONS: [number, number][] = [[2, 4], [4, 8], [3, 6], [6, 8], [2, 8], [3, 12], [9, 12], [6, 20], [15, 20]];
export const DEN_FAMILIES: number[][] = [[2, 4, 8], [3, 6, 12], [5, 10], [2, 3, 6], [2, 5, 10]];

/// števila

export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

export function ulomek(num: number, den: number): Num {
    return { kind: 'ulomek', p: num, q: den, whole: 0, num, den };
}

export function mesano(whole: number, num: number, den: number): Num {
    return { kind: 'mesano', p: whole * den + num, q: den, whole, num, den };
}

/// decimalno število podamo v tisočinah, npr. 0,25 => 250
export function decimalno(thousandths: number): Num {
    return { kind: 'decimalno', p: thousandths, q: 1000, whole: 0, num: 0, den: 0 };
}

export function naravno(n: number): Num {
    return { kind: 'naravno', p: n, q: 1, whole: 0, num: 0, den: 0 };
}

export function compare(a: Num, b: Num): number {
    return a.p * b.q - b.p * a.q;
}

export function thousandthsOf(n: Num): number {
    return (n.p * 1000) / n.q;
}

/// decimalni zapis z vejico, npr. 3/4 => "0,75", null če ima več kot 3 decimalke
export function decimalText(p: number, q: number): string | null {
    for (let k = 0; k <= 3; k++) {
        const scaled = p * 10 ** k;
        if (scaled % q === 0) {
            const digits = String(scaled / q).padStart(k + 1, '0');
            return k === 0 ? digits : `${digits.slice(0, -k)},${digits.slice(-k)}`;
        }
    }
    return null;
}

/// "1,4" => 1400 tisočink, null če ima več kot 3 decimalke
export function parseDecimal(text: string): number | null {
    const [whole, fraction = ''] = text.split(',');
    if (fraction.length > 3) return null;
    return Number(whole) * 1000 + Number(fraction.padEnd(3, '0'));
}

export function inline(n: Num): string {
    switch (n.kind) {
        case 'ulomek': return `${n.num}/${n.den}`;
        case 'mesano': return `${n.whole} ${n.num}/${n.den}`;
        case 'decimalno': return decimalText(n.p, n.q)!;
        case 'naravno': return `${n.p}`;
    }
}

/// koraki pretvorbe ulomka v decimalno število, npr. 6/8 => ["3/4", "75/100", "0,75"]
export function fractionChain(num: number, den: number): string[] {
    if (num % den === 0) return [`${num / den}`]; /// celota, npr. 4/4 = 1
    const steps: string[] = [];
    const g = gcd(num, den);
    if (g > 1 && ![10, 100, 1000].includes(den)) {
        num /= g;
        den /= g;
        steps.push(`${num}/${den}`);
    }
    if (![10, 100, 1000].includes(den)) {
        const target = [10, 100, 1000].find(t => t % den === 0)!;
        steps.push(`${num * (target / den)}/${target}`);
    }
    steps.push(decimalText(num, den)!);
    return steps;
}

/// razlaga za igralca, npr. "3/4 = 75/100 = 0,75" ali "2 1/4 = 2 + 0,25 = 2,25"
export function conversionSteps(n: Num): string {
    if (n.kind === 'mesano') return `${inline(n)} = ${n.whole} + ${decimalText(n.num, n.den)} = ${decimalText(n.p, n.q)}`;
    if (n.kind === 'ulomek') return [inline(n), ...fractionChain(n.num, n.den)].join(' = ');
    return inline(n);
}

export function korakov(n: number): string {
    const mod = n % 100;
    if (mod === 1) return `${n} korak`;
    if (mod === 2) return `${n} koraka`;
    if (mod === 3 || mod === 4) return `${n} korake`;
    return `${n} korakov`;
}

export const between = (min: number, max: number) => Phaser.Math.Between(min, max);
export const pick = <T>(items: T[]): T => Phaser.Utils.Array.GetRandom(items) as T;
export const shuffle = <T>(items: T[]): T[] => Phaser.Utils.Array.Shuffle([...items]);

export class SirnaTehtnica extends Scene {
    level: Level = 1;
    roundIndex: number = 0;
    roundType: RoundType = 'tehtnica';
    tries: number = 0;
    mistakes: number = 0;
    locked: boolean = false;
    nextReady: boolean = false;

    /// objekti trenutnega kroga, uničijo se ob začetku naslednjega
    roundObjects: Phaser.GameObjects.GameObject[] = [];

    /// tehtnica
    beam: Phaser.GameObjects.Rectangle | null = null;
    balanceGfx: Phaser.GameObjects.Graphics | null = null;
    tilt: number = 0;
    leftItem: Phaser.GameObjects.Container | null = null;
    rightItem: Phaser.GameObjects.Container | null = null;

    mouse: Phaser.GameObjects.Sprite;
    hud: Phaser.GameObjects.Text;
    instruction: Phaser.GameObjects.Text;
    message: Phaser.GameObjects.Text;
    nextButton: Phaser.GameObjects.Container;

    panel: Phaser.GameObjects.Container | null = null;
    keyHandler: ((event: KeyboardEvent) => void) | null = null;
    roundKeyHandler: ((event: KeyboardEvent) => void) | null = null;

    constructor() {
        super('SirnaTehtnica');
    }

    create() {
        /// scene.restart() uporabi isto instanco, zato stanje ponastavimo tukaj
        this.level = 1;
        this.roundIndex = 0;
        this.mistakes = 0;
        this.locked = false;
        this.nextReady = false;
        this.roundObjects = [];
        this.beam = null;
        this.balanceGfx = null;
        this.leftItem = null;
        this.rightItem = null;
        this.panel = null;
        this.keyHandler = null;
        this.roundKeyHandler = null;

        this.drawPantry();

        this.mouse = this.add.sprite(MOUSE_HOME.x, MOUSE_HOME.y, 'mouse').setScale(2.5).setAngle(180).setDepth(30);

        this.hud = this.add.text(16, 12, '', {
            fontSize: '20px',
            fontFamily: FONT,
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        }).setDepth(60);

        this.instruction = this.add.text(512, 56, '', {
            fontSize: '22px',
            fontFamily: FONT,
            color: COLOR_TEXT,
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5).setDepth(60);

        this.add.rectangle(512, 135, 944, 96, 0xfff8e6, 0.9).setStrokeStyle(2, 0xc9a96b).setDepth(59);
        this.message = this.add.text(60, 135, '', {
            fontSize: '19px',
            fontFamily: FONT,
            color: COLOR_TEXT,
            wordWrap: { width: 760 }
        }).setOrigin(0, 0.5).setDepth(60);

        this.nextButton = this.createButton(900, 135, 150, 'Naprej ►', () => this.nextRound()).setDepth(61).setVisible(false);

        /// en poslušalec tipkovnice, glede na stanje kliče panel ali krog
        this.input.keyboard!.on('keydown', this.onKeyDown, this);
        this.events.once('shutdown', () => this.input.keyboard?.off('keydown', this.onKeyDown, this));

        /// naslov zavihka med igro, ob izhodu vrnemo prejšnjega
        const previousTitle = document.title;
        document.title = 'Sirna Tehtnica';
        this.events.once('shutdown', () => { document.title = previousTitle; });

        this.updateHud();
        this.cameras.main.fadeIn(150, 0, 0, 0);
        this.showIntro();
    }

    /// ozadje, HUD in sporočila

    drawPantry() {
        const g = this.add.graphics().setDepth(0);
        g.fillStyle(0xf3e3c3, 1);
        g.fillRect(0, 0, 1024, 590);
        g.fillStyle(0xe8d4ab, 1);
        for (let x = 0; x < 1024; x += 64) g.fillRect(x, 0, 2, 590);
        /// miza
        g.fillStyle(0xa0703f, 1);
        g.fillRect(0, 590, 1024, 178);
        g.fillStyle(0x8a5d31, 1);
        g.fillRect(0, 590, 1024, 10);
    }

    updateHud() {
        const total = ROUNDS[this.level].length;
        const round = Math.min(this.roundIndex + 1, total);
        this.hud.setText(`Sirna tehtnica    Težavnost ${this.level}    Krog ${round}/${total}    Napake: ${this.mistakes}`);
    }

    setMessage(text: string, color: string = COLOR_TEXT) {
        this.message.setText(text).setColor(color);
    }

    showNext() {
        this.nextReady = true;
        this.nextButton.setVisible(true);
    }

    onKeyDown(event: KeyboardEvent) {
        if (this.keyHandler) {
            this.keyHandler(event);
        } else if (this.nextReady && (event.key === 'Enter' || event.key === ' ')) {
            this.nextRound();
        } else {
            this.roundKeyHandler?.(event);
        }
    }

    /// panel (okno), enako kot v SirastiKoti

    createPanel(title: string, subtitle: string): Phaser.GameObjects.Container {
        this.closePanel();

        const container = this.add.container(0, 0).setDepth(100);
        const shade = this.add.rectangle(512, 384, 1024, 768, 0x000000, 0.45);
        const bg = this.add.rectangle(512, 384, 840, 620, 0x1e1e2e, 0.96).setStrokeStyle(4, 0xffd23f);
        const titleText = this.add.text(512, 112, title, {
            fontSize: '32px',
            fontFamily: FONT,
            color: '#ffd23f',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        const subtitleText = this.add.text(512, 150, subtitle, {
            fontSize: '20px',
            fontFamily: FONT,
            color: '#ffffff',
            align: 'center',
            wordWrap: { width: 760 }
        }).setOrigin(0.5, 0);

        container.add([shade, bg, titleText, subtitleText]);
        this.panel = container;
        return container;
    }

    closePanel() {
        this.keyHandler = null;
        this.panel?.destroy();
        this.panel = null;
    }

    createButton(x: number, y: number, width: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
        const rect = this.add.rectangle(0, 0, width, 52, 0x3b3b5c)
            .setStrokeStyle(2, 0xffffff)
            .setInteractive({ useHandCursor: true });
        const text = this.add.text(0, 0, label, {
            fontSize: '22px',
            fontFamily: FONT,
            color: '#ffffff'
        }).setOrigin(0.5);

        rect.on('pointerover', () => rect.setFillStyle(0x56568a));
        rect.on('pointerout', () => rect.setFillStyle(0x3b3b5c));
        /// zamik, da ne uničimo gumba med obdelavo njegovega dogodka
        rect.on('pointerdown', () => this.time.delayedCall(0, onClick));

        return this.add.container(x, y, [rect, text]);
    }

    addButton(container: Phaser.GameObjects.Container, x: number, y: number, width: number, label: string, onClick: () => void) {
        container.add(this.createButton(x, y, width, label, onClick));
    }

    showIntro() {
        const container = this.createPanel(
            'Sirna tehtnica',
            'Miška stoji pred tehtnico. Na eni strani je ulomek, na drugi strani pa mora biti rezina sira, ki tehta prav toliko.\n\n' +
            'Z miško povleci pravo rezino sira na tehtnico ali pa sir postavi na pravo mesto na številskem poltraku. ' +
            'Če se zmotiš, se tehtnica nagne in dobiš namig.\n\n' +
            'Težavnost 1: ulomki in decimalna števila, številski poltrak.\n' +
            'Težavnost 2: enakovredni ulomki, mešana števila, urejanje po velikosti.'
        );
        this.addButton(container, 380, 600, 230, '1  Težavnost 1', () => this.startLevel(1));
        this.addButton(container, 644, 600, 230, '2  Težavnost 2', () => this.startLevel(2));
        this.keyHandler = event => {
            if (event.key === '1' || event.key === 'Enter') this.startLevel(1);
            else if (event.key === '2') this.startLevel(2);
        };
    }

    startLevel(level: Level) {
        this.closePanel();
        this.level = level;
        this.roundIndex = 0;
        this.mistakes = 0;
        this.startRound();
    }

    /// potek krogov

    clearRound() {
        this.tweens.killAll();
        this.time.removeAllEvents();
        this.roundObjects.forEach(obj => obj.destroy());
        this.roundObjects = [];
        this.beam = null;
        this.balanceGfx = null;
        this.leftItem = null;
        this.rightItem = null;
        this.tilt = 0;
        this.locked = false;
        this.nextReady = false;
        this.roundKeyHandler = null;
        this.nextButton.setVisible(false);
        this.mouse.setPosition(MOUSE_HOME.x, MOUSE_HOME.y).setAngle(180);
        this.setMessage('');
    }

    track<T extends Phaser.GameObjects.GameObject>(obj: T): T {
        this.roundObjects.push(obj);
        return obj;
    }

    startRound() {
        this.clearRound();
        this.tries = 0;
        this.roundType = ROUNDS[this.level][this.roundIndex];
        this.updateHud();

        switch (this.roundType) {
            case 'tehtnica':
                this.roundTehtnica();
                break;
            case 'poltrak':
                this.roundPoltrak();
                break;
            case 'enakovredni':
                this.roundEnakovredni();
                break;
            case 'urejanje':
                this.roundUrejanje();
                break;
        }
    }

    nextRound() {
        if (!this.nextReady) return;
        this.roundIndex++;
        if (this.roundIndex >= ROUNDS[this.level].length) {
            this.finishGame();
        } else {
            this.startRound();
        }
    }

    success(text: string) {
        this.locked = true;
        this.setMessage(`Pravilno! ${text}`, COLOR_GOOD);
        this.tweens.add({ targets: this.mouse, y: this.mouse.y - 24, duration: 160, yoyo: true, repeat: 1 });
        this.showNext();
    }

    registerMistake() {
        this.tries++;
        this.mistakes++;
        this.updateHud();
        this.tweens.add({ targets: this.mouse, angle: this.mouse.angle + 12, duration: 70, yoyo: true, repeat: 2 });
    }

    /// krogi (še v izdelavi)

    roundTehtnica() {
        this.placeholderRound('Tehtnica: ulomek = decimalno število');
    }

    roundPoltrak() {
        this.placeholderRound('Številski poltrak');
    }

    roundEnakovredni() {
        this.placeholderRound('Enakovredni ulomki z modelom');
    }

    roundUrejanje() {
        this.placeholderRound('Urejanje po velikosti');
    }

    /// začasno krog samo pokaže ime in gumb Naprej, da lahko preizkusimo potek igre
    placeholderRound(name: string) {
        this.instruction.setText(name);
        this.setMessage('Ta krog še ni narejen.');
        this.showNext();
    }

    /// konec igre

    finishGame() {
        this.clearRound();
        this.instruction.setText('');

        const stars = this.mistakes === 0 ? 3 : this.mistakes <= 3 ? 2 : 1;
        const container = this.createPanel(
            'Bravo! Miška je stehtala ves sir.',
            `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}\n\nTežavnost ${this.level}    Napake: ${this.mistakes}`
        );

        if (this.level === 1) this.addButton(container, 380, 600, 230, '2  Težavnost 2', () => this.startLevel(2));
        else this.addButton(container, 380, 600, 230, '1  Ponovi', () => this.startLevel(2));
        this.addButton(container, 644, 600, 230, 'Glavna igra (Enter)', () => this.returnToMainGame());

        this.keyHandler = event => {
            if (event.key === 'Enter') this.returnToMainGame();
            else if (event.key === '2' && this.level === 1) this.startLevel(2);
            else if (event.key === '1' && this.level === 2) this.startLevel(2);
        };
    }

    returnToMainGame() {
        this.closePanel();
        this.scene.start('Game');
    }
}
