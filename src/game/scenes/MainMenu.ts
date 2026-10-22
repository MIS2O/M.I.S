import { Scene, GameObjects } from 'phaser';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;

    constructor ()
    {
        super('MainMenu');
    }

    create ()
    {
        this.background = this.add.image(512, 384, 'background');

        //this.logo = this.add.image(512, 300, 'logo');

        this.title = this.add.text(512, 450, 'Click to start game', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5);

        // Uporaba animacije
        const mouseIcon = this.add.sprite(512,530, 'mouse-click');

        mouseIcon.setScale(6);

        mouseIcon.play('mouse-click-anim');

        this.input.once('pointerdown', () => {

            this.scene.start('Game');

        });
    }
}
