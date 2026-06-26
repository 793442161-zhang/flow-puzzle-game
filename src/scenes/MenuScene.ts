import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import { loadProgress, resetProgress } from '../game/storage';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const { width, height } = this.scale;
    const progress = loadProgress();

    this.drawBackground();
    this.createLogo();
    this.createStarBar(progress.stars, LEVELS.length);
    this.createLevelGrid(progress);

    // 重置进度（小字）
    const resetArea = this.add.rectangle(width / 2, height - 26, 120, 36, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height - 26, '重置进度', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '14px',
      color: '#A5D6A7',
    }).setOrigin(0.5);
    resetArea.on('pointerdown', () => {
      resetProgress();
      this.scene.restart();
    });
  }

  private drawBackground() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0xE8F5E9, 0xE8F5E9, 0xF1F8E9, 0xF1F8E9, 1);
    bg.fillRect(0, 0, width, height);

    const bubbleData = [
      { x: -40, y: 60, r: 100, color: 0xC8E6C9, a: 0.3 },
      { x: width + 30, y: 120, r: 80, color: 0xB2DFDB, a: 0.25 },
      { x: width * 0.6, y: height - 60, r: 90, color: 0xDCEDC8, a: 0.22 },
      { x: 30, y: height * 0.6, r: 60, color: 0xF0F4C3, a: 0.28 },
    ];
    bubbleData.forEach(b => {
      bg.fillStyle(b.color, b.a);
      bg.fillCircle(b.x, b.y, b.r);
    });

    const wave = this.add.graphics();
    wave.fillStyle(0x66BB6A, 0.1);
    wave.fillEllipse(width / 2, -40, width * 1.4, 200);
  }

  private createLogo() {
    const { width } = this.scale;
    const lw = 260, lh = 100, lx = (width - lw) / 2, ly = 60;

    const logoG = this.add.graphics();
    logoG.fillStyle(0xFFFFFF, 0.9);
    logoG.fillRoundedRect(lx, ly, lw, lh, 24);
    logoG.lineStyle(2.5, 0xA5D6A7, 0.5);
    logoG.strokeRoundedRect(lx, ly, lw, lh, 24);

    this.add.text(width / 2, ly + 38, '🌿 填满格子', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '28px', fontStyle: 'bold', color: '#2E7D32',
    }).setOrigin(0.5);

    this.add.text(width / 2, ly + 74, 'Fill The Grid · 益智解谜', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '15px', color: '#81C784',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: logoG,
      y: '+=6',
      duration: 2200,
      yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createStarBar(stars: number, total: number) {
    const { width } = this.scale;
    const y = 196;
    const bw = 190, bh = 38;

    const barG = this.add.graphics();
    barG.fillStyle(0xFFFFFF, 0.82);
    barG.fillRoundedRect((width - bw) / 2, y - bh / 2, bw, bh, 19);

    this.add.text(width / 2, y, `⭐  ${stars} / ${total}  已获星星`, {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '17px', fontStyle: 'bold', color: '#F9A825',
    }).setOrigin(0.5);
  }

  private createLevelGrid(progress: ReturnType<typeof loadProgress>) {
    const { width } = this.scale;
    const cols = 5;
    const btnSize = 58;
    const gap = 10;
    const totalW = cols * btnSize + (cols - 1) * gap;
    const startX = (width - totalW) / 2;
    const startY = 240;

    this.add.text(width / 2, startY - 22, '选择关卡', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '20px', fontStyle: 'bold', color: '#4CAF50',
    }).setOrigin(0.5);

    LEVELS.forEach((level, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = startX + col * (btnSize + gap) + btnSize / 2;
      const cy = startY + 18 + row * (btnSize + gap) + btnSize / 2;

      const isUnlocked = level.id <= progress.unlockedLevel;
      const isCompleted = progress.completedLevels.includes(level.id);

      // 阴影
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.08);
      shadow.fillRoundedRect(cx - btnSize / 2 + 2, cy - btnSize / 2 + 3, btnSize, btnSize, 14);

      // 按钮背景
      const bg = this.add.graphics();
      if (isCompleted) {
        bg.fillStyle(0x66BB6A, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 14);
        bg.fillStyle(0xFFFFFF, 0.2);
        bg.fillRoundedRect(cx - btnSize / 2 + 4, cy - btnSize / 2 + 4, btnSize - 8, btnSize * 0.38, 9);
      } else if (isUnlocked) {
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 14);
        bg.lineStyle(2.5, 0x81C784, 1);
        bg.strokeRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 14);
      } else {
        bg.fillStyle(0xEEEEEE, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 14);
      }

      // 文字/图标
      const label = isUnlocked ? (isCompleted ? '✓' : `${level.id}`) : '🔒';
      const labelColor = isCompleted ? '#FFFFFF' : (isUnlocked ? '#2E7D32' : '#BDBDBD');
      const fontSize = isCompleted ? '22px' : (isUnlocked ? '20px' : '18px');

      this.add.text(cx, cy + 1, label, {
        fontFamily: '"PingFang SC", sans-serif',
        fontSize, fontStyle: 'bold', color: labelColor,
      }).setOrigin(0.5);

      // 已解锁关卡：用透明矩形作为点击热区（比 container 更可靠）
      if (isUnlocked) {
        const hitArea = this.add.rectangle(cx, cy, btnSize, btnSize, 0x000000, 0)
          .setInteractive({ useHandCursor: true });

        hitArea.on('pointerover', () => {
          this.tweens.add({ targets: [bg, shadow], scaleX: 1.1, scaleY: 1.1, duration: 100 });
        });
        hitArea.on('pointerout', () => {
          this.tweens.add({ targets: [bg, shadow], scaleX: 1, scaleY: 1, duration: 100 });
        });
        hitArea.on('pointerdown', () => {
          this.tweens.add({
            targets: [bg, shadow], scaleX: 0.92, scaleY: 0.92, duration: 70, yoyo: true,
            onComplete: () => {
              this.scene.start('GameScene', { levelIndex: i });
            },
          });
        });
      }

      // 进场动画
      [bg, shadow].forEach(obj => {
        obj.setScale(0);
        this.tweens.add({
          targets: obj,
          scaleX: 1, scaleY: 1,
          duration: 180,
          delay: 80 + i * 35,
          ease: 'Back.easeOut',
        });
      });
    });
  }
}
