import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    const { width, height } = this.scale;

    // Loading背景
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xE8F5E9, 0xE8F5E9, 0xF1F8E9, 0xF1F8E9, 1);
    bg.fillRect(0, 0, width, height);

    // Loading文字
    const loadingText = this.add.text(width / 2, height / 2 - 30, '🌿 加载中...', {
      fontFamily: '"Nunito", "PingFang SC", sans-serif',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#4CAF50',
    }).setOrigin(0.5);

    // 进度条背景
    const barBg = this.add.graphics();
    barBg.fillStyle(0xC8E6C9, 1);
    barBg.fillRoundedRect(width / 2 - 120, height / 2 + 20, 240, 16, 8);

    // 进度条
    const bar = this.add.graphics();
    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0x66BB6A, 1);
      bar.fillRoundedRect(width / 2 - 120, height / 2 + 20, 240 * value, 16, 8);
    });

    // 跳动动画
    this.tweens.add({
      targets: loadingText,
      y: height / 2 - 38,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  create() {
    this.scene.start('MenuScene');
  }
}
