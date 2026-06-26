import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

/**
 * 清晰度方案说明：
 *
 * Phaser 3 在 Scale.FIT 模式下会自动把 canvas CSS 尺寸缩放到屏幕大小，
 * 同时内部渲染仍使用 width×height 的逻辑分辨率。
 *
 * 要在高DPI屏上清晰，需要：
 * 1. 不要同时设置顶层 zoom 和 scale.zoom，否则会双倍放大造成坐标偏移
 * 2. 用 Phaser 内置的 resolution 方案（Phaser 3.60+ 已弃用 resolution，改用 zoom）
 * 3. 最可靠方案：把 width/height 设为逻辑尺寸，用 Scale.FIT 让 Phaser 
 *    自动把 canvas CSS 尺寸适配屏幕，canvas 物理像素由浏览器的 devicePixelRatio 决定
 *
 * 注意：Scale.FIT + zoom=1 时，pointer 坐标就是逻辑坐标，无需额外转换
 */

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#F0FDF4',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  scene: [BootScene, MenuScene, GameScene],
  parent: 'app',
  render: {
    antialias: true,
    pixelArt: false,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
  },
};

new Phaser.Game(config);
