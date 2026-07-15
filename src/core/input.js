// Keyboard + mouse input with pointer lock.
// Pointer lock is what makes mouse-look feel right; it only engages after a
// user gesture (click), so the game shows a "click to play" prompt first.

export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.firePressed = false;   // edge-triggered this frame
    this.fireHeld = false;
    this._justPressed = new Set();

    this._onKeyDown = (e) => {
      const c = e.code;
      if (!this.keys.has(c)) this._justPressed.add(c);
      this.keys.add(c);
      // Prevent the page from scrolling on space/arrows while playing.
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);

    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (this.locked && e.button === 0) {
        this.fireHeld = true;
        this.firePressed = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.fireHeld = false;
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) {
        this.fireHeld = false;
        this.keys.clear();
      }
      this.onLockChange?.(this.locked);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  requestLock() {
    this.dom.requestPointerLock?.();
  }

  exitLock() {
    document.exitPointerLock?.();
  }

  down(code) {
    return this.keys.has(code);
  }

  // True only on the frame the key went down.
  pressed(code) {
    return this._justPressed.has(code);
  }

  // Consume per-frame edge state. Call once at the end of each frame.
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.firePressed = false;
    this._justPressed.clear();
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }
}
