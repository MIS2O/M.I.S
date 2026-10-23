import { Scene } from 'phaser';

interface RoomExit {
    x?: number;
    y?: number;
    targetRoom: string;
    spawnX: number;
    spawnY: number;
    lookAngle: number;
}

const ROOMS: Record<string, { exits: RoomExit[] }> = {
    'Start_Room': {
        exits: [
            // Levi izhod
            { x: 0, targetRoom: 'Feri_Logo_Room', spawnX: 13, spawnY: 10, lookAngle: 90 },
            // Desni izhod
            //{ x: 14, targetRoom: 'Unassigned_Room', spawnX: 13, spawnY: 10, lookAngle: 90 },
            // Zgornji izhod
            //{ y: 0, targetRoom: 'Unassigned_Room', spawnX: 13, spawnY: 10, lookAngle: 90 }
        ]
    },
    'Feri_Logo_Room': {
        exits: [
            { x: 14, targetRoom: 'Start_Room', spawnX: 1, spawnY: 7, lookAngle: -90 }
        ]
    }
};
export class Game extends Scene {
    player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    wasd: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };

    map: Phaser.Tilemaps.Tilemap;
    collidableLayers: (Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null)[] = [];
    tileX: number = 7;
    tileY: number = 7;
    tileSizeOnScreen: number = 32;
    offsetX: number = 0;
    offsetY: number = 0;
    isMoving: boolean = false;

    currentRoom: string = 'Start_Room';
    spawnAngle: number = 0;

    constructor() {
        super('Game');
    }

    init(data: { roomKey?: string; spawnX?: number; spawnY?: number; angle?: number }) {
        this.currentRoom = data?.roomKey || 'Start_Room';
        this.tileX = data?.spawnX ?? 7;
        this.tileY = data?.spawnY ?? 7;
        this.spawnAngle = data?.angle ?? 0;
        this.isMoving = false;
    }

    create() {
        this.isMoving = false;

        // Select room
        this.map = this.make.tilemap({ key: this.currentRoom });

        // Combinas vse tilesete
        const tilesetWalls = this.map.addTilesetImage('Floors and walls', 'room-tiles');
        const tilesetDeco = this.map.addTilesetImage('Decoration', 'decoration');
        const allTilesets = [tilesetWalls!, tilesetDeco!];

        // Kreairas layerje
        const wallsFloorLayer = this.map.createLayer('Walls&Floor', allTilesets, 0, 0);
        const collisionLayer = this.map.createLayer('Collision walls', allTilesets, 0, 0);
        const behindDecoLayer = this.map.createLayer('BehindDecoration', allTilesets, 0, 0);
        const midBehindDecoLayer = this.map.createLayer('MiddleBehindDecorationn', allTilesets, 0, 0);
        const decorationLayer = this.map.createLayer('Decoration', allTilesets, 0, 0);
        const midTopDecoLayer = this.map.createLayer('MiddleTopDecoation', allTilesets, 0, 0);
        const topDecoLayer = this.map.createLayer('TopDecoration', allTilesets, 0, 0);

        // Shranis vse layerje
        const allLayers = [
            wallsFloorLayer, collisionLayer, behindDecoLayer, midBehindDecoLayer,
            decorationLayer, midTopDecoLayer, topDecoLayer
        ];

        // Resizas in centriras na sobo
        const scale = 4; // 1 tile = 8px, 8 * 4 = 32px (tileSizeOnScreen)
        this.tileSizeOnScreen = 8 * scale;

        const mapWidth = this.map.widthInPixels * scale;
        const mapHeight = this.map.heightInPixels * scale;
        this.offsetX = (this.scale.width - mapWidth) / 2;
        this.offsetY = (this.scale.height - mapHeight) / 2;

        allLayers.forEach(layer => {
            layer?.setScale(scale);
            layer?.setPosition(this.offsetX, this.offsetY);
        });

        // Vsi layerji ko majo collision
        this.collidableLayers = [
            topDecoLayer,
            midTopDecoLayer,
            decorationLayer,
            midBehindDecoLayer,
            behindDecoLayer,
            collisionLayer,
        ];

        this.collidableLayers.forEach(layer => {
            layer?.setCollisionByExclusion([-1]);
        });
        collisionLayer?.setVisible(false); // Zakomentiri ce hoces da je collision layer viden

        // Postavitev playerja
        const startX = this.offsetX + (this.tileX + 0.5) * this.tileSizeOnScreen;
        const startY = this.offsetY + (this.tileY + 0.5) * this.tileSizeOnScreen;

        this.player = this.physics.add.sprite(startX, startY, 'mouse');

        this.player.setScale(1);
        this.player.body.setSize(24, 24);
        this.player.body.setOffset(4, 4);
        this.player.setAngle(this.spawnAngle);

        // Nastaviš layerje po globini kerga hoces videt prej
        wallsFloorLayer?.setDepth(0);
        collisionLayer?.setDepth(1);
        behindDecoLayer?.setDepth(2);
        midBehindDecoLayer?.setDepth(3);
        this.player.setDepth(10);
        decorationLayer?.setDepth(11);
        midTopDecoLayer?.setDepth(12);
        topDecoLayer?.setDepth(13);

        this.cursors = this.input.keyboard!.createCursorKeys();
        this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as any;

        // transition FADE IN
        this.cameras.main.fadeIn(150, 0, 0, 0);
    }

    canMoveTo(targetTileX: number, targetTileY: number): boolean {
        if (
            targetTileX < 0 ||
            targetTileX >= this.map.width ||
            targetTileY < 0 ||
            targetTileY >= this.map.height
        ) {
            return false;
        }

        // Preveri collision za en block naprej
        for (const layer of this.collidableLayers) {
            if (layer && layer.hasTileAt(targetTileX, targetTileY)) {
                return false;
            }
        }

        return true;
    }

    checkRoomExit(): boolean {
        const roomData = ROOMS[this.currentRoom];
        if (!roomData) return false;

        for (const exit of roomData.exits) {
            const matchX = exit.x === undefined || exit.x === this.tileX;
            const matchY = exit.y === undefined || exit.y === this.tileY;

            if (matchX && matchY) {
                this.isMoving = true;

                // transition FADE OUT
                this.cameras.main.fadeOut(150, 0, 0, 0);
                this.cameras.main.once('camerafadeoutcomplete', () => {
                    this.scene.restart({
                        roomKey: exit.targetRoom,
                        spawnX: exit.spawnX,
                        spawnY: exit.spawnY,
                        angle: exit.lookAngle
                    });
                });
                return true;
            }
        }

        return false;
    }

    update() {
        if (this.isMoving) {
            return;
        }

        const left = this.cursors.left.isDown || this.wasd.A.isDown;
        const right = this.cursors.right.isDown || this.wasd.D.isDown;
        const up = this.cursors.up.isDown || this.wasd.W.isDown;
        const down = this.cursors.down.isDown || this.wasd.S.isDown;

        let dx = 0;
        let dy = 0;

        if (left) {
            dx = -1;
            this.player.setAngle(90);
        } else if (right) {
            dx = 1;
            this.player.setAngle(-90);
        } else if (up) {
            dy = -1;
            this.player.setAngle(180);
        } else if (down) {
            dy = 1;
            this.player.setAngle(0);
        }

        if (dx === 0 && dy === 0) {
            return;
        }

        const nextTileX = this.tileX + dx;
        const nextTileY = this.tileY + dy;

        // Preveri najprej collision pol se pa premakne če ni ka na poti
        if (this.canMoveTo(nextTileX, nextTileY)) {
            this.isMoving = true;
            this.tileX = nextTileX;
            this.tileY = nextTileY;

            const targetX = this.offsetX + (this.tileX + 0.5) * this.tileSizeOnScreen;
            const targetY = this.offsetY + (this.tileY + 0.5) * this.tileSizeOnScreen;

            this.tweens.add({
                targets: this.player,
                x: targetX,
                y: targetY,
                duration: 100, // Kok casa rabi da nardi korak (0.1s)
                ease: 'Linear',
                onComplete: () => {
                    if (!this.checkRoomExit()) {
                        this.isMoving = false;
                    }
                }
            });
        }
    }
}
