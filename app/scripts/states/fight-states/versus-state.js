let config = require('../../configs');
import FightState from './fight-state';
import Computer from '../../models/computer';

let { shout, addSaiyanLabel } = require('../../helpers/message');
let { loadSoundPreferences } = require('../../helpers/audio');

/**
 * @extends FightState
 */
export default class VersusState extends FightState {
    audio = {
        jump: null,

        weakkick: null,
        weakpunch: null,

        mediumkick: null,
        mediumpunch: null,

        strongkick: null,
        strongpunch: null
    };
    options = {
        player: {
            hp: null,
            exp: null,
            lvl: null
        },
        enemy: {
            hp: null,
            exp: null,
            lvl: null
        }
    };

    create() {
        this.add.image(0, 0, 'bg-versus-sky');

        this._setupWorld();
        this._setupKeyboard();
        this._setupSound();

        this._setupSprite(150, 360, this.game.player);
        this._setupSprite(650, 360, this.game.enemy, [1, 1]);
        this._setupPlayerOptions();
        this._setupEnemyOptions();

        this._setupFight();

        this.displayLogo();
        shout(this.game, { text: `${this.game.locale.VERSUS_STATE_WELCOME}` });

        loadSoundPreferences(this.game);
    }

    _setupFight() {
        let context = this;
        let player = this.game.player;
        let enemy = this.game.enemy;

        function isCollision() {
            return context.physics.arcade.overlap(enemy.phaser, player.phaser);
        }

        function handlePlayerBlow(points) {
            if (isCollision()) {
                context._addPlayerEXP(points * 1.75);
                context._removeEnemyHP(points);
            }
        }

        player.phaser.events.onKicking.add(() => handlePlayerBlow(config.VERSUS_KICKING_POINTS));
        player.phaser.events.onBoxing.add(() => handlePlayerBlow(config.VERSUS_BOXING_POINTS));
        player.phaser.events.onDied.add(() => this._finishFight('died', 'win'));

        function handleEnemyBlow(points) {
            if (isCollision()) {
                context._addEnemyEXP(points);
                context._removePlayerHP(points);
            }
        }

        enemy.phaser.events.onKicking.add(() => handleEnemyBlow(config.VERSUS_KICKING_POINTS));
        enemy.phaser.events.onBoxing.add(() => handleEnemyBlow(config.VERSUS_BOXING_POINTS));
        enemy.phaser.events.onDied.add(() => this._finishFight('win', 'died'));

        Computer.applyArtificialIntelligence(this, enemy);
    }

    _finishFight(playerSate, enemyState) {
        let player = this.game.player;
        let enemy = this.game.enemy;

        // Wyłączamy wsparcie klawiatury w grze.
        this.input.keyboard.enabled = false;

        shout(this.game, { text: `${player.name} ${this.game.locale['VERSUS_STATE_PLAYER_' + playerSate.toUpperCase()]}!` });

        player.phaser.play(playerSate);
        enemy.phaser.play(enemyState);

        this.game.time.events.add(Phaser.Timer.SECOND * 2, () => {
            // Przywracamy wsparcie klawiatury w grze.
            this.input.keyboard.enabled = true;

            if (playerSate === 'died') {
                this.state.start('GameOver');
            } else {
                // Usuwamy pierwszego, pokonanego wroga.
                this.game.enemies.shift();
                this.game.emit('enemy:killed', { enemy: this.game.enemy });

                if (this.game.enemies.length === 0) {
                    this.state.start('Winner');
                } else {
                    this.state.start('Meal', true, false, {
                        lifetime: Phaser.Timer.SECOND * 4,
                        cb: () => {
                            this.state.start('Training', true, false, {
                                lifetime: Phaser.Timer.SECOND * 5,
                                cb: () => {
                                    this.state.start('EnemyPresentation', true, false, {
                                        lifetime: Phaser.Timer.SECOND * 4,
                                        cb: () => {
                                            this.state.start('Versus');
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });
    }

    _setupEnemyOptions() {
        let enemy = this.game.enemy;

        addSaiyanLabel(this.game, 755, 18, 'HP');
        addSaiyanLabel(this.game, 755, 48, 'EXP');
        this._addAvatar(745, 85, `${enemy.id}-card`);

        this.options.enemy.lvl = addSaiyanLabel(this.game, 733, 81, `${enemy.lvl} ${this.game.locale.FIGHT_STATE_LEVEL_SHORT}`, [1, 0]);

        this.options.enemy.hp = this._addBar(746, 25, 'bar-hp-invert', [1, 0]);
        this._updateEnemyOptionsHP();

        this.options.enemy.exp = this._addBar(746, 55, 'bar-exp-invert', [1, 0]);
        this._updateEnemyOptionsEXP();
    }

    _updateEnemyOptionsHP() {
        let hp = this.game.enemy.hp;
        let imageWidth = this.cache.getImage('bar-hp-invert').width;
        let width = hp * imageWidth / 100;
        this.options.enemy.hp.color.crop(new Phaser.Rectangle(imageWidth - width, 0, width, 16));
    }

    _updateEnemyOptionsEXP() {
        let exp = this.game.enemy.exp;
        let imageWidth = this.cache.getImage('bar-exp').width;
        let width = exp * imageWidth / 100;
        this.options.enemy.exp.color.crop(new Phaser.Rectangle(imageWidth - width, 0, width, 16));
    }

    _removeEnemyHP(value) {
        let enemy = this.game.enemy;
        enemy.hp -= value;

        if (enemy.hp <= 0) {
            enemy.hp = 0;
            enemy.phaser.events.onDied.dispatch();
        }

        this._updateEnemyOptionsHP();
        this._updateOptionsLvL('enemy');
    }

    _addEnemyEXP(value) {
        let enemy = this.game.enemy;
        enemy.exp += value;

        if (enemy.exp >= config.PLAYER_MAXIMUM_EXPERIENCE) {
            enemy.exp = 0;

            if (enemy.lvl < config.PLAYER_MAXIMUM_LEVEL) {
                enemy.lvl++;
            }
        }

        this._updateEnemyOptionsEXP();
        this._updateOptionsLvL('enemy');
    }

    update() {
        super.update();
        FightState.resetCharacterVelocity(this.game.enemy);
    }

    render() {
        let player = this.game.player;
        // this.game.debug.bodyInfo(player.phaser, 25, 25);
        this.game.debug.body(player.phaser);

        let enemy = this.game.enemy;
        // this.game.debug.bodyInfo(enemy.phaser, 25, 225);
        this.game.debug.body(enemy.phaser);
    }
}
