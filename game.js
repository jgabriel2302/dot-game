/* ##############################################################################
####		created by João Gabriel Corrêa da Silva			            	####
####	    https://www.joaogabrielcorreadasilva.com.br                    	####
   ############################################################################## */
(function(){
    const _timers = [];
    let _timerId = 0;
    function scheduleTimeout(callback, ms = 0) {
        const id = ++_timerId;
        _timers.push({ id, callback, remaining: Math.max(0, ms) / 1000 });
        return id;
    }
    function cancelTimeout(id) {
        const idx = _timers.findIndex((t) => t.id === id);
        if (idx >= 0) _timers.splice(idx, 1);
    }
    function updateTimers(deltaTime = 0) {
        const ready = [];
        for (let i = _timers.length - 1; i >= 0; i--) {
            const t = _timers[i];
            t.remaining -= deltaTime;
            if (t.remaining <= 0) {
                ready.push(t);
                _timers.splice(i, 1);
            }
        }
        for (const t of ready) {
            try { t.callback?.(); } catch (err) { console.error(err); }
        }
    }

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js").catch((err) => {
                console.error("Service worker registration failed:", err);
            });
        });
    }

    //#region Global Entities
    class GameObject {
        static type = "generic";
        x = 0;
        y = 0;
        constructor(){
            this.id = Math.floor(performance.now() * Math.random());
            this.name = `object_${this.id}`;
            this.start();
        }
        
        start(){

        }

        render(canvas, ctx, deltaTime, opts = {}){

        }

        update(deltaTime, inputManager){

        }
    }

    class EmptyObject extends GameObject {
        updates = [];
        update(deltaTime, inputManager){
            for (const update of this.updates) {
                if(typeof update === "function") update(deltaTime, inputManager);
            }
        }
    }

    class InputManager {
        inputs = {};
        currentGamepad = null;

        swipe = {
            enabled: true,
            minDistance: 20,
            maxTime: 500,
            pulseMs: 80,
            deadzone: 10,
            pointerId: null,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0,
            startT: 0,
            isDown: false,
        };

        tilt = {
            enabled: true,
            gamma: 0,
            smoothGamma: 0,
            smoothing: 0.15,
            deadzone: 2,
            maxGamma: 25,
            scale: 1,
            initialized: false,
            support: false
        };

        bindings = [
            { bind: "up", input: "w" },
            { bind: "down", input: "s" },
            { bind: "left", input: "a" },
            { bind: "right", input: "d" },
            { bind: "dash", input: " " },
            { bind: "pause", input: "escape" },

            { bind: "up", input: "arrow_up" },
            { bind: "down", input: "arrow_down" },
            { bind: "left", input: "arrow_left" },
            { bind: "right", input: "arrow_right" },

            { bind: "up", input: "gp_up" },
            { bind: "down", input: "gp_down" },
            { bind: "left", input: "gp_left" },
            { bind: "right", input: "gp_right" },
            { bind: "dash", input: "gp_dash" },
            { bind: "pause", input: "pause" },

            { bind: "up", input: "swipe_up" },
            { bind: "down", input: "swipe_down" },
            { bind: "left", input: "swipe_left" },
            { bind: "right", input: "swipe_right" },

            { bind: "left", input: "tilt_left" },
            { bind: "right", input: "tilt_right" },
        ];

        constructor({ element = window } = {}) {
            element.addEventListener("keydown", (e) => {
                const k = e.key.toLowerCase();
                this.inputs[k] = 1;

                const arrowMap = {
                    arrowup: "arrow_up",
                    arrowdown: "arrow_down",
                    arrowleft: "arrow_left",
                    arrowright: "arrow_right",
                };
                if (k.startsWith("arrow")) {
                    const alias = arrowMap[k];
                    if (alias) this.inputs[alias] = 1;
                }

                if (k === "escape") this.inputs["pause"] = 1;
            });

            element.addEventListener("keyup", (e) => {
                const k = e.key.toLowerCase();
                this.inputs[k] = 0;

                const arrowMap = {
                    arrowup: "arrow_up",
                    arrowdown: "arrow_down",
                    arrowleft: "arrow_left",
                    arrowright: "arrow_right",
                };
                const alias = arrowMap[k];
                if (alias) this.inputs[alias] = 0;

                if (k === "escape") this.inputs["pause"] = 0;
            });

            if (this.swipe.enabled) {
                if (element !== window && element.style) element.style.touchAction = "none";

                element.addEventListener("pointerdown", (e) => this.#onPointerDown(e), { passive: false });
                window.addEventListener("pointermove", (e) => this.#onPointerMove(e), { passive: false });
                window.addEventListener("pointerup", (e) => this.#onPointerUp(e), { passive: false });
                window.addEventListener("pointercancel", (e) => this.#onPointerUp(e), { passive: false });
            }

            element.addEventListener(
                "pointermove",
                (e) => {
                    this.inputs["cursor_x"] = e.clientX;
                    this.inputs["cursor_y"] = e.clientY;
                },
                { passive: false }
            );
            element.addEventListener(
                "mousemove",
                (e) => {
                    this.inputs["cursor_x"] = e.clientX;
                    this.inputs["cursor_y"] = e.clientY;
                },
                { passive: false }
            );

            if (this.tilt.enabled) {
                this.#bindTiltUnlock(element);
            }
        }

        isActive(action = "") {
            return this.getInputValue(action) !== 0;
        }

        getInputValue(action = "") {
            const mapped = this.bindings.filter((b) => b.bind === action).map((b) => this.inputs[b.input] ?? 0);
            const direct = this.inputs[action] ?? 0;
            return Math.max(direct, ...mapped, 0);
        }

        async #bindTiltUnlock(element) {
            const requestTiltPermission = async () => {
                if (!this.tilt.enabled || this.tilt.initialized) return;

                try {
                    if (
                        typeof DeviceOrientationEvent !== "undefined" &&
                        typeof DeviceOrientationEvent.requestPermission === "function"
                    ) {
                        const permission = await DeviceOrientationEvent.requestPermission();
                        this.tilt.support = true;
                        if (permission !== "granted") return;
                    } else if (
                        typeof DeviceMotionEvent !== "undefined" &&
                        typeof DeviceMotionEvent.requestPermission === "function"
                    ) {
                        const permission = await DeviceMotionEvent.requestPermission();
                        this.tilt.support = true;
                        if (permission !== "granted") return;
                    } else {
                        this.tilt.support = false;
                    }

                    window.addEventListener("deviceorientation", (e) => this.#onTilt(e), { passive: true });
                    this.tilt.initialized = true;
                    cleanup();
                } catch (err) {
                    this.tilt.support = false;
                    console.warn("Tilt permission request failed:", err);
                }
            };

            const handler = () => requestTiltPermission();
            const cleanup = () => {
                ["pointerdown", "touchstart", "click", "keydown"].forEach((evt) =>
                    element.removeEventListener(evt, handler)
                );
            };

            ["pointerdown", "touchstart", "click", "keydown"].forEach((evt) =>
                element.addEventListener(evt, handler, { passive: true })
            );
        }

        #onTilt(e) {
            if(!this.tilt.support) return
            const g = e.gamma;
            this.tilt.gamma = Number.isFinite(g) ? g : 0;
        }

        update() {
            this.currentGamepad = navigator.getGamepads ? navigator.getGamepads()[0] : null;

            if (this.currentGamepad) {
                const axes = this.currentGamepad.axes.map((a) => Math.round(a * 10) / 10);

                const ax = axes[0] ?? 0;
                const ay = axes[1] ?? 0;

                this.inputs["gp_left"] = ax < 0 ? Math.abs(ax) : 0;
                this.inputs["gp_right"] = ax > 0 ? Math.abs(ax) : 0;
                this.inputs["gp_up"] = ay < 0 ? Math.abs(ay) : 0;
                this.inputs["gp_down"] = ay > 0 ? Math.abs(ay) : 0;

                this.inputs["arrow_up"] = Math.max(this.inputs["gp_up"], Number(this.currentGamepad.buttons[12]?.pressed));
                this.inputs["arrow_down"] = Math.max(this.inputs["gp_down"], Number(this.currentGamepad.buttons[13]?.pressed));
                this.inputs["arrow_left"] = Math.max(this.inputs["gp_left"], Number(this.currentGamepad.buttons[14]?.pressed));
                this.inputs["arrow_right"] = Math.max(this.inputs["gp_right"], Number(this.currentGamepad.buttons[15]?.pressed));

                const ps_x = Number(this.currentGamepad.buttons[0]?.pressed);
                const ps_r2 = Number(this.currentGamepad.buttons[7]?.pressed);
                this.inputs["gp_dash"] = Number(Boolean(ps_r2 || ps_x));
                this.inputs["pause"] = Number(this.currentGamepad.buttons[9]?.pressed);
            }

            if (this.tilt.enabled && this.tilt.initialized) {
                const t = this.tilt;

                t.smoothGamma += (t.gamma - t.smoothGamma) * t.smoothing;

                let g = t.smoothGamma;
                if (Math.abs(g) < t.deadzone) g = 0;

                const clamped = Math.max(-t.maxGamma, Math.min(t.maxGamma, g));
                const norm = clamped / t.maxGamma;

                const left = norm < 0 ? Math.abs(norm) * t.scale : 0;
                const right = norm > 0 ? Math.abs(norm) * t.scale : 0;

                this.inputs["tilt_left"] = left;
                this.inputs["tilt_right"] = right;
                this.inputs["tilt_axis"] = norm * t.scale;
            } else {
                this.inputs["tilt_left"] = 0;
                this.inputs["tilt_right"] = 0;
                this.inputs["tilt_axis"] = 0;
            }
        }

        #onPointerDown(e) {
            if (this.swipe.isDown) return;
            this.swipe.isDown = true;
            this.swipe.pointerId = e.pointerId;
            this.swipe.startX = this.swipe.lastX = e.clientX;
            this.swipe.startY = this.swipe.lastY = e.clientY;
            this.swipe.startT = performance.now();

            try {
                e.target.setPointerCapture?.(e.pointerId);
            } catch { }
            e.preventDefault?.();
        }

        #onPointerMove(e) {
            if (!this.swipe.isDown || e.pointerId !== this.swipe.pointerId) return;
            this.swipe.lastX = e.clientX;
            this.swipe.lastY = e.clientY;
        }

        #onPointerUp(e) {
            if (!this.swipe.isDown || e.pointerId !== this.swipe.pointerId) return;
            const endT = performance.now();
            const dt = endT - this.swipe.startT;

            const dx = this.swipe.lastX - this.swipe.startX;
            const dy = this.swipe.lastY - this.swipe.startY;

            this.swipe.isDown = false;
            this.swipe.pointerId = null;

            if (dt > this.swipe.maxTime) return;

            const adx = Math.abs(dx);
            const ady = Math.abs(dy);
            const dist = Math.hypot(dx, dy);
            if (dist < this.swipe.minDistance) return;
            if (adx < this.swipe.deadzone && ady < this.swipe.deadzone) return;

            let dir = null;
            if (adx > ady) dir = dx > 0 ? "swipe_right" : "swipe_left";
            else dir = dy > 0 ? "swipe_down" : "swipe_up";

            this.#pulse(dir, this.swipe.pulseMs);
            this.#pulse("swipe_horizontal", this.swipe.pulseMs, dx);
            this.#pulse("swipe_vertical", this.swipe.pulseMs, dy);
            this.#pulse("swipe", this.swipe.pulseMs);
        }

        #pulse(key, ms, value = 1) {
            this.inputs[key] = value;
            scheduleTimeout(() => {
                if (this.inputs[key] === 1) this.inputs[key] = 0;
            }, ms);
        }
    }

    class AudioManager {
        constructor() {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();

            this.master = this.ctx.createGain();
            this.master.connect(this.ctx.destination);

            this.musicBus = this.ctx.createGain();
            this.sfxBus = this.ctx.createGain();

            this.musicBus.connect(this.master);
            this.sfxBus.connect(this.master);

            this.buffers = new Map();

            this.master.gain.value = 1;
            this.musicBus.gain.value = 0.6;
            this.sfxBus.gain.value = 1;

            this.muted = false;

            this._bgmSource = null;
            this._bgmGain = null;
            this._bgmUrl = null;
        }

        bindUnlock({ element = window } = {}) {
            const unlock = async () => {
                if (this.ctx.state !== "running") {
                    try { await this.ctx.resume(); } catch { }
                }
            };
            element.addEventListener("pointerdown", unlock, { once: true });
            element.addEventListener("keydown", unlock, { once: true });
            return unlock;
        }

        async load(url, key = url) {
            if (this.buffers.has(key)) return this.buffers.get(key);

            const res = await fetch(url);
            const ab = await res.arrayBuffer();
            const buf = await this.ctx.decodeAudioData(ab);
            this.buffers.set(key, buf);
            return buf;
        }

        get(key) {
            return this.buffers.get(key) ?? null;
        }

        setMasterVolume(v) {
            this.master.gain.value = Math.max(0, v);
        }

        setMusicVolume(v) {
            this.musicBus.gain.value = Math.max(0, v);
        }

        setSfxVolume(v) {
            this.sfxBus.gain.value = Math.max(0, v);
        }

        mute(on = true) {
            this.muted = on;
            this.master.gain.value = on ? 0 : 1;
        }

        toggleMute() {
            this.mute(!this.muted);
        }

        playSfx(keyOrBuffer, {
            volume = 1,
            playbackRate = 1,
            detune = 0,
            when = 0,
            offset = 0
        } = {}) {
            const buffer = typeof keyOrBuffer === "string" ? this.get(keyOrBuffer) : keyOrBuffer;
            if (!buffer) return null;

            const src = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();

            src.buffer = buffer;
            src.playbackRate.value = playbackRate;
            src.detune.value = detune;

            gain.gain.value = Math.max(0, volume);

            src.connect(gain).connect(this.sfxBus);
            src.start(this.ctx.currentTime + when, offset);

            return { src, gain };
        }

        playSfxVar(key, {
            volume = 1,
            volumeJitter = 0.1,
            rate = 1,
            rateJitter = 0.15,
            detuneJitter = 0
        } = {}) {
            const v = volume * (1 - volumeJitter / 2 + Math.random() * volumeJitter);
            const r = rate * (1 - rateJitter / 2 + Math.random() * rateJitter);
            const d = (Math.random() - 0.5) * detuneJitter;
            return this.playSfx(key, { volume: v, playbackRate: r, detune: d });
        }

        playSfxAt(keyOrBuffer, x, y, listenerX, listenerY, {
            volume = 1,
            maxDist = 500,
            panRange = 300,
            playbackRate = 1
        } = {}) {
            const buffer = typeof keyOrBuffer === "string" ? this.get(keyOrBuffer) : keyOrBuffer;
            if (!buffer) return null;

            const src = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();
            const pan = this.ctx.createStereoPanner();

            const dx = x - listenerX;
            const dy = y - listenerY;
            const dist = Math.hypot(dx, dy);

            const att = Math.max(0, 1 - dist / maxDist);
            gain.gain.value = Math.max(0, volume * att);
            pan.pan.value = Math.max(-1, Math.min(1, dx / panRange));

            src.buffer = buffer;
            src.playbackRate.value = playbackRate;

            src.connect(pan).connect(gain).connect(this.sfxBus);
            src.start();

            return { src, gain, pan };
        }

        async playMusic(keyOrUrl, {
            volume = 0.6,
            fadeIn = 0.25,
            restart = false
        } = {}) {
            const key = keyOrUrl;
            const buffer = this.get(key) ?? (await this.load(keyOrUrl, keyOrUrl));

            if (!restart && this._bgmSource && this._bgmUrl === keyOrUrl) return;

            this.stopMusic({ fadeOut: 0.05 });

            const src = this.ctx.createBufferSource();
            const gain = this.ctx.createGain();

            src.buffer = buffer;
            src.loop = true;

            const t0 = this.ctx.currentTime;
            gain.gain.setValueAtTime(0, t0);
            gain.gain.linearRampToValueAtTime(Math.max(0, volume), t0 + Math.max(0, fadeIn));

            src.connect(gain).connect(this.musicBus);
            src.start();

            this._bgmSource = src;
            this._bgmGain = gain;
            this._bgmUrl = keyOrUrl;

            return { src, gain };
        }

        stopMusic({ fadeOut = 0.2 } = {}) {
            if (!this._bgmSource) return;

            const src = this._bgmSource;
            const gain = this._bgmGain;

            const t0 = this.ctx.currentTime;
            const end = t0 + Math.max(0, fadeOut);

            try {
                gain.gain.cancelScheduledValues(t0);
                gain.gain.setValueAtTime(gain.gain.value, t0);
                gain.gain.linearRampToValueAtTime(0, end);
                src.stop(end + 0.01);
            } catch {
                try { src.stop(); } catch { }
            }

            this._bgmSource = null;
            this._bgmGain = null;
            this._bgmUrl = null;
        }

        async preload(list) {
            await Promise.all(list.map((item) => {
                if (typeof item === "string") return this.load(item, item);
                return this.load(item.url, item.key ?? item.url);
            }));
        }
    }

    class Particle extends GameObject {
        constructor(x, y, vx, vy, life = 0.35, size = 3, fill = "#ffffff") {
            super();
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = life;
            this.maxLife = life;
            this.size = size;
            this.dead = false;
            this.fill = fill;
        }

        update(deltaTime) {
            const dt = deltaTime;
            this.life -= dt;
            if (this.life <= 0) { this.dead = true; return; }

            // this.vy += 900 * dt;
            this.x += this.vx * dt;
            this.y += this.vy * dt;
        }

        render(canvas, ctx) {
            const t = Math.max(0, this.life / this.maxLife);
            ctx.save();
            ctx.globalAlpha = t;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.fill;
            ctx.fill();
            ctx.restore();
        }

        static burst(x, y, count = 12, fill="#ffffff", callback = ()=>{}) {
            const parts = [];
            let time = 0;
            for (let i = 0; i < count; i++) {
                const a = Math.random() * Math.PI * 2;
                const s = 120 + Math.random() * 240;
                const t = 0.25 + Math.random() * 0.25;
                parts.push(new Particle(
                    x, y,
                    Math.cos(a) * s,
                    Math.sin(a) * s,
                    t,
                    2 + Math.random() * 3,
                    fill
                ));
                time += t;
            }

            scheduleTimeout(() => callback(), time * 1000);
            return parts;
        }
    }

    class PixelCollision {
        constructor(width = 1, height = 1, verbose = false) {
            this.c = document.createElement("canvas");
            this.c.width = width;
            this.c.height = height;
            this.ctx = this.c.getContext("2d", { willReadFrequently: true });
            if(verbose) {
                this.c.style.position = 'fixed';
                document.body.append(this.c);
    
                this.c.addEventListener('click', e=>{
                    const data = this.ctx.getImageData(0, this.c.height / 2 - this.c.height * 0.15 , this.c.width, this.c.height * 0.3).data;
                    console.log(data);
                })
            }
        }

        collide(a, b, deltaTime = 0) {
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.c.width, this.c.height);

            ctx.fillStyle = "rgba(255, 0, 0, 1)";
            a.render(this.c, ctx, deltaTime, { fill: "rgba(255, 0, 0, 1)" });
            
            ctx.fillStyle = "rgba(0, 0, 255, 0.5)";
            b.render(this.c, ctx, deltaTime, { fill: "rgba(0, 0, 255, 0.5)" });

            const data = ctx.getImageData(0, this.c.height / 2 - this.c.height * 0.15 , this.c.width, this.c.height * 0.3).data;
            for (let i = 0; i < data.length; i += 4) {
                const [r, g, b, a] = data.slice(i, i+4);
                if( 
                    r >= 151 && r <= 211 && 
                    g >= 0 && g <= 30 && 
                    b >= 44 && b <= 104
                ) return true;
            }
            return false;
        }
    }
    //#endregion

    //#region Setup Engine
    const GAME_STATES = {
        PAUSED: 0,
        PLAYING: 1
    }
    const _canvas = document.getElementById('game') || document.createElement('canvas');
    _canvas.width = window.innerWidth;
    _canvas.height = window.innerHeight;
    _canvas.id = 'game';
    _canvas.setAttribute('tabindex', '-1');
    _canvas.focus();
    _canvas.oncontextmenu = ()=>false;

    const _ctx = _canvas.getContext('2d');

    let objects = [];
    let frames = 0;
    let lastTime = 0;
    let gameState = GAME_STATES.PAUSED;
    const _inputManager = new InputManager({ element: window });
    const _audioManager = new AudioManager();
    const _collision = new PixelCollision(_canvas.width, _canvas.height);
    
    _audioManager.bindUnlock({ element: window });

    const PLAYER_DEFAULT_COLOR = "#04e19e";
    let currentPlayerColor = PLAYER_DEFAULT_COLOR;
    let playerColorStack = [];

    function render(timestamp = 0){
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;
        updateTimers(deltaTime);
        if(gameState === GAME_STATES.PAUSED) return requestAnimationFrame(render); 
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

        _inputManager.update();

        objects = objects.filter(o=>!(o.dead === true));

        for (const object of objects) {
            if(object instanceof GameObject){
                object.update(deltaTime, _inputManager);
            }
        }

        for (const object of objects) {
            if(object instanceof GameObject){
                object.render(_canvas, _ctx, deltaTime);
            }
        }

        frames++;
        requestAnimationFrame(render);
    }
    render();
    document.body.prepend(_canvas);
    //#endregion


    //#region Game Entities
    class Player extends GameObject {
        static type = 'player';
        start(){
            this.radius = 15;
            this.x = window.innerWidth / 2;
            this.y = window.innerHeight / 2;
        }
        render(canvas, ctx, deltaTime, opts = {}) {
            ctx.beginPath();
            ctx.fillStyle = opts.fill ?? currentPlayerColor;
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        update(deltaTime, inputManager){
            const baseSpeed = window.innerWidth * 0.01;
            const tiltAxis = inputManager.inputs["tilt_axis"] ?? 0;

            if(inputManager.tilt.support) this.x = tiltAxis * window.innerWidth + window.innerWidth / 2;
            
            if(inputManager.isActive('right')){
                this.x += baseSpeed;
            }

            if(inputManager.isActive('left')){
                this.x -= baseSpeed;
            }

            this.x = Math.max( window.innerWidth * 0.05, Math.min( window.innerWidth * 0.95, this.x ))
        }
    }

    class PlayerTrack extends GameObject {
        static type = 'decorative';
        drawTrack(ctx) {
            const start = window.innerWidth * 0.05;
            const end = window.innerWidth * 0.95;
            const y = window.innerHeight / 2;
            const r = 10;
            ctx.beginPath();
            ctx.fillStyle = "#00000033";
            ctx.arc(start, y, r, 0, Math.PI * 2);
            ctx.rect(start, y-r, end-start, r*2);
            ctx.arc(end, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        render(canvas, ctx, deltaTime) {
            this.drawTrack(ctx);
        }
    }

    class Enemy extends GameObject {
        static type = 'enemy';
        constructor(){
            super();
            this.minSpeedY = 100;
            this.dead = false;
        }

        start() {
            this.x = window.innerWidth * Math.random();
            this.y = -50 * Math.random() - 20;

            this.size = Math.random() * 15 + 10;
            this.speedY = 120 * Math.random() + (this.minSpeedY ?? 100);
            this.speedX = 2 * Math.random() - 1;
            this.angle = 0;
            this.spin = Math.PI * Math.random();
        }

        render(canvas, ctx, deltaTime, opts = {}) {
            ctx.save();

            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);

            ctx.beginPath();
            ctx.fillStyle = opts.fill ?? "#fff";
            ctx.rect(-this.size / 2, -this.size / 2, this.size, this.size);
            ctx.fill()

            ctx.restore();
        }

        update(deltaTime, inputManager) {
            const dt = deltaTime;
            this.y += this.speedY * dt;
            this.x += this.speedX * dt;
            this.angle += this.spin * dt;

            if (this.y - this.size > window.innerHeight) {
                this.start();
            }
        }

        kill(){
            return Particle.burst(this.x, this.y, this.size, "#ffffff")
        }
    }

    class EnemyEnsemble extends GameObject {
        constructor(ensemble = 5){
            super();
            this.enemies = new Array(ensemble).fill({}).map(e=>new Enemy());
            this.freeze = false;
        }
        
        start(){
            if(this.enemies){
                for (const enemy of this.enemies) {
                    enemy.start();
                }
            }
        }

        render(canvas, ctx, deltaTime, opts = {}){
            for (const enemy of this.enemies) {
                enemy.render(canvas, ctx, deltaTime, opts);
            }
        }
        update(deltaTime, inputManager){
            if(this.freeze) return;
            for (const enemy of this.enemies) {
                enemy.update(deltaTime, inputManager);
            }
        }

        addEnemy(){
            if(this.enemies.length < 20) {
                this.enemies.push(new Enemy());
            } else {
                for (const enemy of this.enemies) {
                    enemy.minSpeedY += Math.floor( Math.random() * 50 );
                }
            }
        }

        kill(){
            for (const enemy of this.enemies) {
                enemy.kill();
            }
        }
    }

    class Food extends GameObject {
        static type = 'food';
        constructor(player){
            super();
            this.player = player || {x: 0, y: 0};
        }
        start() {
            this.x = window.innerWidth * Math.random();
            this.y = -50 * Math.random() - 20;

            this.radius = Math.random() * 10 + 5;
            this.speedY = 120 * Math.random() + 100;
            this.speedX = 20 * Math.random() - 10;
        }

        render(canvas, ctx, deltaTime, opts = {}) {
            ctx.beginPath();
            ctx.fillStyle = opts.fill ?? "#04e19e";
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        update(deltaTime, inputManager) {
            const dt = deltaTime;
            this.y += this.speedY * dt;
            this.x += this.speedX * dt;
            if (isEffectActive("attract-food")) {
                const dx = this.player.x - this.x;
                const dy = this.player.y - this.y;
                const dist = Math.hypot(dx, dy) || 1;
                const pull = Math.min(50, 50 / dist);
                this.x += dx * pull * dt * 3;
                this.y += dy * pull * dt * 3;                
            }
            if (this.y - this.radius > window.innerHeight) {
                this.start();
            }
        }
    }

    class PowerUps extends GameObject {
        static type = 'powerups';
        static POWERUP_TYPES = {
            freeze: "freeze",
            killAll: "kill-all",
            attractFood: "attract-food",
            doublePoints: "double-points",
            untouchable: "untouchable",
        };
        static META = {
            freeze: { fill: "#72daed", label: "Freeze", shape: "circle", duration: 3000 },
            "kill-all": { fill: "#ff4d6d", label: "Kill All", shape: "square" },
            "attract-food": { fill: "#e18504", label: "Attract Food", shape: "triangle", duration: 5000 },
            "double-points": { fill: "#ffdd55", label: "Double Points", shape: "diamond", duration: 7000 },
            untouchable: { fill: "#8f7efc", label: "Untouchable", shape: "pentagon", duration: 5000 },
        }
        start() {
            this.x = window.innerWidth * Math.random();
            this.y = -50 * Math.random() - 20;

            this.radius = Math.random() * 10 + 5;
            this.speedY = 120 * Math.random() + 100;
            this.speedX = 20 * Math.random() - 10;
            this.dead = false;
            const types = Object.values(PowerUps.POWERUP_TYPES);
            this.type = types[Math.floor(Math.random() * types.length)];
        }

        render(canvas, ctx, deltaTime, opts = {}) {
            const meta = PowerUps.META[this.type] ?? {};
            const fill = opts.fill ?? meta.fill ?? "#e18504";
            const r = this.radius;
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.fillStyle = fill;
            switch (meta.shape) {
                case "square": {
                    ctx.rotate(0.2);
                    ctx.fillRect(-r, -r, r * 2, r * 2);
                    break;
                }
                case "triangle": {
                    ctx.beginPath();
                    for (let i = 0; i < 3; i++) {
                        const a = i * (Math.PI * 2 / 3) - Math.PI / 2;
                        const px = Math.cos(a) * r * 1.3;
                        const py = Math.sin(a) * r * 1.3;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
                }
                case "diamond": {
                    ctx.beginPath();
                    ctx.moveTo(0, -r * 1.4);
                    ctx.lineTo(r * 1.1, 0);
                    ctx.lineTo(0, r * 1.4);
                    ctx.lineTo(-r * 1.1, 0);
                    ctx.closePath();
                    ctx.fill();
                    break;
                }
                case "pentagon": {
                    ctx.beginPath();
                    for (let i = 0; i < 5; i++) {
                        const a = i * (Math.PI * 2 / 5) - Math.PI / 2;
                        const px = Math.cos(a) * r * 1.2;
                        const py = Math.sin(a) * r * 1.2;
                        if (i === 0) ctx.moveTo(px, py);
                        else ctx.lineTo(px, py);
                    }
                    ctx.closePath();
                    ctx.fill();
                    break;
                }
                case "circle":
                default: {
                    ctx.beginPath();
                    ctx.arc(0, 0, r, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                }
            }
            ctx.restore();
        }

        update(deltaTime, inputManager) {
            const dt = deltaTime;
            this.y += this.speedY * dt;
            this.x += this.speedX * dt;
            if (this.y - this.radius > window.innerHeight) {
                this.dead = true;
            }
        }
    }
    //#endregion

    //#region Game Logic
    const player = new Player();
    const enemies = new EnemyEnsemble(1);
    const food = new Food(player);
    const gameManager = new EmptyObject();
    const powerups = new PowerUps();
    const activeEffects = {
        freeze: false,
        "attract-food": false,
        "double-points": false,
        untouchable: false
    };
    const effectTimers = {};
    let powerupSpawnTimer = null;
    let toastTimeoutId = null;

    const gameData = {
        best: Number( window.localStorage.getItem('GAME_DATA.best') ?? 0 ),
        points: 0
    }

    const uiElements = {
        pauseMenu: document.querySelector('.in-pause'),
        best: document.querySelector('#best'),
        ingame: document.querySelector('.in-game'),
        pauseBtn: document.querySelector('.in-game .actions #pauseBtn'),
        startBtn: document.querySelector('.in-pause #startBtn'),
        muteBtn: document.querySelector('.in-game .actions #muteBtn'),
        points: document.querySelector('#points'),
        powerupToast: document.querySelector('.powerup-toast')
    }

    function isEffectActive(key){
        return Boolean(activeEffects[key]);
    }

    function updatePlayerColor(){
        const top = playerColorStack[playerColorStack.length - 1];
        currentPlayerColor = top?.color ?? PLAYER_DEFAULT_COLOR;
    }

    function activateEffect(key, durationMs = 3000, color){
        activeEffects[key] = true;
        if (color) {
            playerColorStack = playerColorStack.filter((c)=>c.key !== key);
            playerColorStack.push({ key, color });
            _canvas.style.setProperty("--powerup-color", (color) + "44");
            updatePlayerColor();
        }
        if(effectTimers[key]) cancelTimeout(effectTimers[key]);
        effectTimers[key] = scheduleTimeout(()=>{
            activeEffects[key] = false;
            playerColorStack = playerColorStack.filter((c)=>c.key !== key);
            updatePlayerColor();
            effectTimers[key] = null;            
            _canvas.style.setProperty("--powerup-color", "#00000044");
        }, durationMs);
    }

    function showPowerupToast(meta){
        if(!uiElements.powerupToast || !meta?.label) return;
        uiElements.powerupToast.textContent = meta.label;
        uiElements.powerupToast.style.setProperty("--toast-color", meta.fill ?? "#04e19e");
        uiElements.powerupToast.classList.add("show");
        if(toastTimeoutId) cancelTimeout(toastTimeoutId);
        toastTimeoutId = scheduleTimeout(()=>{
            uiElements.powerupToast.classList.remove("show");
            toastTimeoutId = null;
        }, 1600);
    }

    function addPowerUp(){
        if(powerupSpawnTimer) return;
        powerupSpawnTimer = scheduleTimeout(()=>{
            if(objects.findIndex(x=>x.id === powerups.id) === -1){
                powerups.start();
                objects.push(powerups);
            }
            powerupSpawnTimer = null;
        }, 10000 * Math.random() + 5000);
    }

    function applyPowerUp(type){
        const meta = PowerUps.META[type] ?? { label: type, fill: "#04e19e" };
        showPowerupToast(meta);

        if (type === PowerUps.POWERUP_TYPES.freeze) {
            enemies.freeze = true;
            activateEffect("freeze", meta.duration ?? 3000, meta.fill);
        }

        if (type === PowerUps.POWERUP_TYPES.killAll) {
            for (const enemy of enemies.enemies) {
                objects.push(...Particle.burst(enemy.x, enemy.y, 8, meta.fill));
                enemy.start();
            }
        }

        if (type === PowerUps.POWERUP_TYPES.attractFood) {
            activateEffect("attract-food", meta.duration ?? 5000, meta.fill);
        }

        if (type === PowerUps.POWERUP_TYPES.doublePoints) {
            activateEffect("double-points", meta.duration ?? 7000, meta.fill);
        }

        if (type === PowerUps.POWERUP_TYPES.untouchable) {
            activateEffect("untouchable", meta.duration ?? 5000, meta.fill);
        }
    }


    function playCollect(x, y){
        _audioManager.playSfxAt("collect", window.innerWidth / 2, window.innerHeight / 2, x, y, { 
            volume: 0.8,
            maxDist: window.innerWidth * 0.4
        });
    }

    gameManager.updates.push((deltaTime, inputManager)=>{
        enemies.freeze = isEffectActive("freeze");
        const invincible = isEffectActive("untouchable");

        if (!invincible && _collision.collide(player, enemies, deltaTime)) {
            enemies.enemies = [];
            enemies.addEnemy();
            food.start();
            gameData.best = gameData.points > gameData.best? gameData.points: gameData.best;
            window.localStorage.setItem('GAME_DATA.best', gameData.best);
            uiElements.best.textContent = gameData.best;
            uiElements.pauseMenu.classList.add('show');
            _audioManager.playSfxVar("hit", { volume: 0.8, rateJitter: 0.2 });
            objects = [...Particle.burst(player.x, player.y, 15, "#ffffff")];
            //gameState = GAME_STATES.PAUSED;
        }

        if (_collision.collide(player, food, deltaTime)) {
            objects.push(...Particle.burst(food.x, food.y, 5, "#04e19e"));
            food.start();
            const gain = isEffectActive("double-points") ? 2 : 1;
            gameData.points += gain;
            uiElements.points.textContent = gameData.points;  
            enemies.addEnemy();
            _canvas.classList.remove("shake");
            void _canvas.offsetWidth;
            _canvas.classList.add("shake");
            playCollect(player.x, player.y);
        }

        if (_collision.collide(player, powerups, deltaTime)) {
            const meta = PowerUps.META[powerups.type] ?? {};
            objects.push(...Particle.burst(powerups.x, powerups.y, 5, meta.fill ?? "#e18504"));
            playCollect(powerups.x, powerups.y);
            applyPowerUp(powerups.type);
            powerups.y = -400000;
            powerups.dead = true;
        }

        if(powerups.dead === true) addPowerUp();
    });

    function restartGame(){
        Object.keys(activeEffects).forEach(k=>{
            activeEffects[k] = false;
            if(effectTimers[k]) cancelTimeout(effectTimers[k]);
            effectTimers[k] = null;
        });
        if(powerupSpawnTimer) {
            cancelTimeout(powerupSpawnTimer);
            powerupSpawnTimer = null;
        }
        if(toastTimeoutId){
            cancelTimeout(toastTimeoutId);
            toastTimeoutId = null;
        }
        uiElements.powerupToast?.classList.remove("show");
        playerColorStack = [];
        currentPlayerColor = PLAYER_DEFAULT_COLOR;

        objects = [];
        player.start();
        enemies.start();
        food.start();
        powerups.start();
        objects.push(new PlayerTrack(), player, enemies, food, powerups, gameManager);
        uiElements.pauseMenu.classList.remove('show');
        uiElements.pauseMenu.classList.remove('first');
        gameData.points = 0;
        gameState = GAME_STATES.PLAYING;
        uiElements.points.textContent = '-';
    }


    _audioManager.preload([
        { key: "hit", url: "hit.wav" },
        { key: "collect", url: "collect.wav" },
        { key: "bgm", url: "music.mp3" },
    ]).then(e=>{
        window.addEventListener("pointerdown", () => {
            _audioManager.playMusic("bgm", { volume: 0.5 });
        }, { once: true });
        window.addEventListener("mousemove", () => {
            _audioManager.playMusic("bgm", { volume: 0.5 });
        }, { once: true });
    });

    uiElements.startBtn.addEventListener('click', e=>restartGame());

    //#endregion
})()
