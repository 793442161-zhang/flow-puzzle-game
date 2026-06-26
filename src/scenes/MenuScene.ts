import Phaser from 'phaser';
import { LEVELS } from '../data/levels';
import { loadProgress, resetProgress } from '../game/storage';

export class MenuScene extends Phaser.Scene {
  private levelPanel!: Phaser.GameObjects.Container;
  private panelVisible = false;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    const progress = loadProgress();

    this.drawBackground();
    this.createHomeScreen(progress);
    this.createLevelPanel(progress);
  }

  // ─── 背景 ────────────────────────────────────────────────────────────────────
  private drawBackground() {
    const { width, height } = this.scale;
    const bg = this.add.graphics();

    // 纯色背景（浅绿白）
    bg.fillStyle(0xF2FAF2, 1);
    bg.fillRect(0, 0, width, height);

    // 顶部柔和色块
    bg.fillStyle(0xDFF0DE, 1);
    bg.fillRect(0, 0, width, height * 0.45);

    // 装饰气泡 - 更大更明显
    const bubbles = [
      { x: -50, y: 80, r: 120, color: 0xA5D6A7, a: 0.25 },
      { x: width + 40, y: 150, r: 100, color: 0x80CBC4, a: 0.2 },
      { x: width * 0.7, y: height * 0.88, r: 110, color: 0xC5E1A5, a: 0.2 },
      { x: 20, y: height * 0.65, r: 75, color: 0xE6EE9C, a: 0.22 },
      { x: width * 0.88, y: height * 0.38, r: 60, color: 0xA5D6A7, a: 0.18 },
      { x: width * 0.15, y: height * 0.35, r: 40, color: 0xB2DFDB, a: 0.15 },
    ];
    bubbles.forEach(b => {
      bg.fillStyle(b.color, b.a);
      bg.fillCircle(b.x, b.y, b.r);
    });
  }

  // ─── 主页内容 ─────────────────────────────────────────────────────────────────
  private createHomeScreen(progress: ReturnType<typeof loadProgress>) {
    const { width, height } = this.scale;

    // ── Logo 区域 ──
    const logoY = height * 0.2;

    // 外光晕
    const iconBg = this.add.graphics();
    iconBg.fillStyle(0x43A047, 0.08);
    iconBg.fillCircle(width / 2, logoY, 80);
    iconBg.fillStyle(0x43A047, 0.13);
    iconBg.fillCircle(width / 2, logoY, 58);
    // 图标底座
    iconBg.fillStyle(0xFFFFFF, 0.6);
    iconBg.fillCircle(width / 2, logoY, 44);

    this.add.text(width / 2, logoY, '🌿', { fontSize: '52px' })
      .setOrigin(0.5);

    this.add.text(width / 2, logoY + 64, '填满格子', {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '36px',
      fontStyle: 'bold',
      color: '#1B5E20',
    }).setOrigin(0.5);

    this.add.text(width / 2, logoY + 104, 'Fill The Grid · 益智解谜', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '14px',
      color: '#66BB6A',
    }).setOrigin(0.5);

    // ── 进度展示 ──
    const progressY = height * 0.46;
    const completed = progress.completedLevels.length;
    const total = LEVELS.length;

    // 进度卡片阴影
    const cardG = this.add.graphics();
    const cardW = Math.min(width - 48, 320);
    const cardH = 78;
    const cardX = (width - cardW) / 2;

    // 阴影层
    cardG.fillStyle(0x2E7D32, 0.08);
    cardG.fillRoundedRect(cardX + 3, progressY - cardH / 2 + 6, cardW, cardH, 20);
    // 卡片白底
    cardG.fillStyle(0xFFFFFF, 0.96);
    cardG.fillRoundedRect(cardX, progressY - cardH / 2, cardW, cardH, 20);
    // 卡片边框
    cardG.lineStyle(1.5, 0xC8E6C9, 1);
    cardG.strokeRoundedRect(cardX, progressY - cardH / 2, cardW, cardH, 20);
    // 左侧绿色装饰条
    cardG.fillStyle(0x43A047, 1);
    cardG.fillRoundedRect(cardX + 1, progressY - cardH / 2 + 14, 4, cardH - 28, 2);

    // 进度条
    const barPad = 20;
    const barW = cardW - barPad * 2;
    const barH = 7;
    const barX = cardX + barPad;
    const barY = progressY + 18;
    cardG.fillStyle(0xEEF5EE, 1);
    cardG.fillRoundedRect(barX, barY, barW, barH, 4);
    const fillRatio = total > 0 ? completed / total : 0;
    if (fillRatio > 0) {
      cardG.fillStyle(0x43A047, 1);
      cardG.fillRoundedRect(barX, barY, barW * fillRatio, barH, 4);
    }

    this.add.text(width / 2, progressY - 10, `⭐ ${progress.stars} 星  ·  已通关 ${completed} / ${total}`, {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#1B5E20',
    }).setOrigin(0.5);

    // ── 按钮区域 ──
    const btnAreaY = height * 0.64;
    const btnW = Math.min(width - 48, 300);

    // 找到当前应该继续的关卡（最新未完成或第一关）
    const nextLevelIndex = this.getNextLevelIndex(progress);

    // 主按钮：继续游戏 / 开始游戏
    const mainLabel = completed > 0 ? `继续游戏  第 ${nextLevelIndex + 1} 关  ▶` : '开始游戏  ▶';
    const mainBtn = this.createBigBtn(
      width / 2, btnAreaY,
      btnW, 62,
      mainLabel,
      () => {
        this.scene.start('GameScene', { levelIndex: nextLevelIndex });
      }
    );

    // 次按钮：选择关卡
    const selectBtn = this.createOutlineBtn(
      width / 2, btnAreaY + 84,
      btnW, 54,
      '📋  选择关卡',
      () => this.openLevelPanel(),
    );

    // 进场动画
    [mainBtn, selectBtn].forEach((btn, i) => {
      btn.setAlpha(0);
      btn.y += 24;
      this.tweens.add({
        targets: btn,
        alpha: 1,
        y: btn.y - 24,
        duration: 380,
        delay: 180 + i * 90,
        ease: 'Back.easeOut',
      });
    });

    // 重置进度（小字，底部）
    const resetArea = this.add.rectangle(width / 2, height - 30, 120, 36, 0x000000, 0)
      .setInteractive({ useHandCursor: true });
    this.add.text(width / 2, height - 30, '重置进度', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '13px',
      color: '#A5D6A7',
    }).setOrigin(0.5);
    resetArea.on('pointerdown', () => {
      resetProgress();
      this.scene.restart();
    });
  }

  // ─── 主按钮（鲜艳实心绿） ──────────────────────────────────────────────────────
  private createBigBtn(
    x: number, y: number,
    w: number, h: number,
    label: string,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const r = h / 2;

    // 投影（偏绿色阴影，更自然）
    const shadow = this.add.graphics();
    shadow.fillStyle(0x2E7D32, 0.28);
    shadow.fillRoundedRect(-w / 2 + 3, -h / 2 + 6, w, h, r);

    // 按钮主体（深绿底色）
    const bg = this.add.graphics();
    bg.fillStyle(0x2E7D32, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);

    // 亮绿色前景（错位制造立体感）
    bg.fillStyle(0x43A047, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h - 4, r);

    // 顶部高光条
    bg.fillStyle(0xFFFFFF, 0.22);
    bg.fillRoundedRect(-w / 2 + 8, -h / 2 + 6, w - 16, h * 0.38, r * 0.7);

    const text = this.add.text(0, -1, label, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#FFFFFF',
      shadow: { offsetX: 0, offsetY: 1, color: '#1B5E20', blur: 2, fill: true },
    }).setOrigin(0.5);

    btn.add([shadow, bg, text]);

    const hitArea = this.add.rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      this.tweens.add({
        targets: btn,
        scaleX: 0.95, scaleY: 0.95,
        duration: 80,
        yoyo: true,
        onComplete: () => callback(),
      });
    });

    return btn;
  }

  // ─── 次按钮（描边空心） ────────────────────────────────────────────────────────
  private createOutlineBtn(
    x: number, y: number,
    w: number, h: number,
    label: string,
    callback: () => void,
  ): Phaser.GameObjects.Container {
    const btn = this.add.container(x, y);
    const r = h / 2;

    // 微阴影
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000000, 0.06);
    shadow.fillRoundedRect(-w / 2 + 2, -h / 2 + 4, w, h, r);

    // 白色底 + 绿色描边
    const bg = this.add.graphics();
    bg.fillStyle(0xFFFFFF, 0.95);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
    bg.lineStyle(2, 0x43A047, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

    const text = this.add.text(0, 0, label, {
      fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#2E7D32',
    }).setOrigin(0.5);

    btn.add([shadow, bg, text]);

    const hitArea = this.add.rectangle(x, y, w, h, 0x000000, 0)
      .setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', () => {
      this.tweens.add({
        targets: btn,
        scaleX: 0.95, scaleY: 0.95,
        duration: 80,
        yoyo: true,
        onComplete: () => callback(),
      });
    });

    return btn;
  }

  // ─── 获取下一个应玩的关卡 ─────────────────────────────────────────────────────
  private getNextLevelIndex(progress: ReturnType<typeof loadProgress>): number {
    // 找第一个未完成的解锁关卡
    for (let i = 0; i < LEVELS.length; i++) {
      if (!progress.completedLevels.includes(LEVELS[i].id)) {
        return i;
      }
    }
    // 全部完成，回到最后一关
    return LEVELS.length - 1;
  }

  // ─── 关卡选择面板（从底部弹出） ──────────────────────────────────────────────
  private createLevelPanel(progress: ReturnType<typeof loadProgress>) {
    const { width, height } = this.scale;

    const panelH = height * 0.72;
    // 面板初始隐藏：y 放到屏幕外底部足够远，且设为不可见
    const container = this.add.container(0, height + panelH + 80);
    container.setDepth(100);
    container.setVisible(false); // 初始不可见，打开时再显示
    this.levelPanel = container;

    // 遮罩层
    const mask = this.add.graphics();
    mask.fillStyle(0x000000, 0.5);
    mask.fillRect(0, -height, width, height); // 相对 container 的坐标
    container.add(mask);

    // 面板背景
    const panel = this.add.graphics();
    panel.fillStyle(0xF9FBF9, 1);
    panel.fillRoundedRect(0, -panelH, width, panelH + 40, { tl: 24, tr: 24, bl: 0, br: 0 });
    container.add(panel);

    // 顶部把手
    const handle = this.add.graphics();
    handle.fillStyle(0xC8E6C9, 1);
    handle.fillRoundedRect(width / 2 - 22, -panelH + 12, 44, 5, 3);
    container.add(handle);

    // 标题
    const titleText = this.add.text(width / 2, -panelH + 38, '选择关卡', {
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#2E7D32',
    }).setOrigin(0.5);
    container.add(titleText);

    // 关卡格子
    const cols = 5;
    const btnSize = Math.min(52, (width - 60) / cols);
    const gap = (width - 60 - cols * btnSize) / (cols - 1);
    const startX = 30 + btnSize / 2;
    const startY = -panelH + 80;

    LEVELS.forEach((level, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const cx = startX + col * (btnSize + gap);
      const cy = startY + row * (btnSize + gap + 8) + btnSize / 2;

      const isCompleted = progress.completedLevels.includes(level.id);
      const isUnlocked = level.id <= progress.unlockedLevel;

      // 阴影
      const shadow = this.add.graphics();
      shadow.fillStyle(0x000000, 0.06);
      shadow.fillRoundedRect(cx - btnSize / 2 + 2, cy - btnSize / 2 + 3, btnSize, btnSize, 12);
      container.add(shadow);

      // 按钮背景
      const bg = this.add.graphics();
      if (isCompleted) {
        bg.fillStyle(0x66BB6A, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 12);
        bg.fillStyle(0xFFFFFF, 0.2);
        bg.fillRoundedRect(cx - btnSize / 2 + 3, cy - btnSize / 2 + 3, btnSize - 6, btnSize * 0.35, 8);
      } else if (isUnlocked) {
        bg.fillStyle(0xFFFFFF, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 12);
        bg.lineStyle(2, 0x81C784, 1);
        bg.strokeRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 12);
      } else {
        bg.fillStyle(0xECEFF1, 1);
        bg.fillRoundedRect(cx - btnSize / 2, cy - btnSize / 2, btnSize, btnSize, 12);
      }
      container.add(bg);

      // 文字
      const label = isCompleted ? '✓' : (isUnlocked ? `${level.id}` : '🔒');
      const labelColor = isCompleted ? '#FFFFFF' : (isUnlocked ? '#2E7D32' : '#B0BEC5');
      const labelSize = isCompleted ? '20px' : (isUnlocked ? '18px' : '16px');
      const labelText = this.add.text(cx, cy + 1, label, {
        fontFamily: '"PingFang SC", sans-serif',
        fontSize: labelSize,
        fontStyle: 'bold',
        color: labelColor,
      }).setOrigin(0.5);
      container.add(labelText);

      // 关卡名（小字）
      if (isUnlocked) {
        const nameText = this.add.text(cx, cy + btnSize / 2 + 6, level.title.slice(0, 4), {
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: '9px',
          color: isCompleted ? '#81C784' : '#A5D6A7',
        }).setOrigin(0.5);
        container.add(nameText);
      }

      // 点击交互
      if (isUnlocked) {
        const hitArea = this.add.rectangle(cx, cy, btnSize, btnSize, 0x000000, 0)
          .setInteractive({ useHandCursor: true });
        container.add(hitArea);

        hitArea.on('pointerdown', () => {
          this.tweens.add({
            targets: [bg, shadow],
            scaleX: 0.9, scaleY: 0.9,
            duration: 70, yoyo: true,
            onComplete: () => {
              this.closeLevelPanel(() => {
                this.scene.start('GameScene', { levelIndex: i });
              });
            },
          });
        });
      }
    });

    // 点击遮罩关闭
    mask.setInteractive(
      new Phaser.Geom.Rectangle(0, -height, width, height - panelH),
      Phaser.Geom.Rectangle.Contains
    );
    mask.on('pointerdown', () => this.closeLevelPanel());
  }

  // ─── 打开关卡面板 ─────────────────────────────────────────────────────────────
  private openLevelPanel() {
    if (this.panelVisible) return;
    this.panelVisible = true;
    const { height } = this.scale;
    const panelH = height * 0.72;
    // 先设为可见，再做动画
    this.levelPanel.setVisible(true);
    this.levelPanel.y = height + panelH + 80;
    // 打开：container.y 移到 height-40，面板底部贴屏幕底
    this.tweens.add({
      targets: this.levelPanel,
      y: height - 40,
      duration: 380,
      ease: 'Cubic.easeOut',
    });
  }

  // ─── 关闭关卡面板 ─────────────────────────────────────────────────────────────
  private closeLevelPanel(onComplete?: () => void) {
    if (!this.panelVisible) return;
    this.panelVisible = false;
    const { height } = this.scale;
    const panelH = height * 0.72;
    this.tweens.add({
      targets: this.levelPanel,
      y: height + panelH + 80,
      duration: 320,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.levelPanel.setVisible(false);
        onComplete?.();
      },
    });
  }
}
