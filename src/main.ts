import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

/**
 * 高 DPI 清晰度方案（最终确定版）：
 *
 * 问题根源分析：
 * 每个 Game Object 渲染时，都会调用 SetTransform.js 里的：
 *   calcMatrix.setToContext(ctx)
 * 它内部使用 ctx.setTransform(this)（绝对赋值），会完全覆盖任何之前设置的 scale(dpr,dpr)。
 * calcMatrix = gameObject.matrix × camera.matrix，两者都不含 dpr 缩放。
 *
 * 解决方案（最优）：
 * 拦截 Phaser.GameObjects.Components.TransformMatrix.prototype.setToContext，
 * 在写入 ctx 之前，把矩阵的 6 个分量全部 × dpr：
 *   [a, b, c, d, e, f] × dpr → ctx.setTransform(a*dpr, b*dpr, c*dpr, d*dpr, e*dpr, f*dpr)
 * 这等价于在原始变换之前预乘一个 scale(dpr, dpr) 矩阵。
 *
 * 同时：
 * 1. 拦截 ScaleManager.updateScale，升级 canvas 物理分辨率（× dpr）并固定 CSS 尺寸
 * 2. 拦截 CanvasRenderer.preRender，把 clearRect/fillRect 范围扩展到整个物理 canvas
 *
 * 结果：游戏逻辑坐标 = CSS 逻辑像素（场景代码完全不变），渲染清晰
 */

const dpr = window.devicePixelRatio || 1;
const W = window.innerWidth;
const H = window.innerHeight;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.CANVAS,
  width: W,
  height: H,
  backgroundColor: '#F0FDF4',
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: W,
    height: H,
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
  callbacks: {
    postBoot: (game) => {
      if (dpr <= 1) return;

      const canvas = game.canvas;

      // ─── 1. 升级 canvas 物理分辨率 ────────────────────────────────────────────
      // 拦截 ScaleManager.updateScale，在 Phaser 设置 canvas.width/height 为逻辑像素后，
      // 立即升级为物理像素，并固定 CSS 尺寸为逻辑像素
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sm = game.scale as any;
      const originalUpdateScale = sm.updateScale.bind(sm);
      sm.updateScale = function () {
        originalUpdateScale();
        const lw = canvas.width;
        const lh = canvas.height;
        if (lw > 0 && lh > 0 && lw < lw * dpr) {
          canvas.width = Math.round(lw * dpr);
          canvas.height = Math.round(lh * dpr);
          canvas.style.width = `${lw}px`;
          canvas.style.height = `${lh}px`;
        } else if (canvas.style.width === '') {
          // 首次：样式尚未设置
          canvas.style.width = `${canvas.width / dpr}px`;
          canvas.style.height = `${canvas.height / dpr}px`;
        }
      };

      // ─── 2. 扩展 preRender 的清空范围 ─────────────────────────────────────────
      // Phaser preRender 里 this.width/height 是逻辑尺寸（430），clearRect 只清逻辑区域
      // 需要清空整个物理 canvas（860），否则会有残影
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = game.renderer as any;
      const originalPreRender = r.preRender.bind(r);
      r.preRender = function () {
        // 临时把渲染器的 width/height 改为物理像素，让 clearRect 清整个 canvas
        const origW = this.width;
        const origH = this.height;
        this.width = canvas.width;
        this.height = canvas.height;
        originalPreRender();
        // 还原逻辑尺寸，确保后续渲染坐标系正确
        this.width = origW;
        this.height = origH;
      };

      // ─── 3. 拦截 TransformMatrix.setToContext，注入 dpr 缩放 ─────────────────
      // 每个 Game Object 渲染时调用此方法写入最终变换矩阵
      // 原逻辑：ctx.setTransform(a, b, c, d, e, f)
      // 修改后：ctx.setTransform(a*dpr, b*dpr, c*dpr, d*dpr, e*dpr, f*dpr)
      // 等价于：先 scale(dpr, dpr)，再应用原始变换
      const TransformMatrix = (Phaser.GameObjects.Components as any).TransformMatrix;
      const originalSetToContext = TransformMatrix.prototype.setToContext;
      TransformMatrix.prototype.setToContext = function (ctx: CanvasRenderingContext2D) {
        const m = this.matrix;
        ctx.setTransform(
          m[0] * dpr, m[1] * dpr,
          m[2] * dpr, m[3] * dpr,
          m[4] * dpr, m[5] * dpr,
        );
        return ctx;
      };

      // ─── 4. 立即触发一次 updateScale 应用物理分辨率 ───────────────────────────
      sm.updateScale();

      // 保留引用防止 GC（实际不需要，但明确意图）
      void originalSetToContext;
    },
  },
};

new Phaser.Game(config);
