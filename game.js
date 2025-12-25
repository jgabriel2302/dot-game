/* ##############################################################################
####		created by João Gabriel Corrêa da Silva			            	####
####	    https://www.joaogabrielcorreadasilva.com.br                    	####
   ############################################################################## */
(function(){
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

            element.addEventListener("pointermove", (e) => {
                this.inputs['cursor_x'] = e.clientX;
                this.inputs['cursor_y'] = e.clientY;
            }, { passive: false });
            element.addEventListener("mousemove", (e) => {
                this.inputs['cursor_x'] = e.clientX;
                this.inputs['cursor_y'] = e.clientY;
            }, { passive: false });
        }

        isActive(action = "") {
            return this.getKeyValue(action) !== 0;
        }

        getInputValue(action = "") {
            const mapped = this.bindings
                .filter((b) => b.bind === action)
                .map((b) => this.inputs[b.input] ?? 0);

            const direct = this.inputs[action] ?? 0;
            return Math.max(direct, ...mapped, 0);
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
        }

        #onPointerDown(e) {
            if (this.swipe.isDown) return;
            this.swipe.isDown = true;
            this.swipe.pointerId = e.pointerId;
            this.swipe.startX = this.swipe.lastX = e.clientX;
            this.swipe.startY = this.swipe.lastY = e.clientY;
            this.swipe.startT = performance.now();

            try { e.target.setPointerCapture?.(e.pointerId); } catch { }
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
            setTimeout(() => {
                if (this.inputs[key] === 1) this.inputs[key] = 0;
            }, ms);
        }
    }

    class Particle extends GameObject {
        constructor(x, y, vx, vy, life = 0.35, size = 3) {
            super();
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.life = life;
            this.maxLife = life;
            this.size = size;
            this.dead = false;
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
            ctx.fill();
            ctx.restore();
        }

        static burst(x, y, count = 12, callback = ()=>{}) {
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
                    2 + Math.random() * 3
                ));
                time += t;
            }

            setTimeout(()=>callback(), time * 1000);
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
    const _inputManager = new InputManager({ element: _canvas });
    const _collision = new PixelCollision(_canvas.width, _canvas.height);

    function render(timestamp = 0){
        if(gameState === GAME_STATES.PAUSED) return requestAnimationFrame(render); 
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        const deltaTime = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

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
            ctx.fillStyle = opts.fill ?? "#04e19e";
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
        update(deltaTime, inputManager){
            const cursor_x = inputManager.getInputValue('cursor_x');
            this.x = Math.max( window.innerWidth * 0.1, Math.min( window.innerWidth * 0.9, cursor_x ))
        }
    }

    class PlayerTrack extends GameObject {
        static type = 'decorative';
        drawTrack(ctx) {
            const start = window.innerWidth * 0.1;
            const end = window.innerWidth * 0.9;
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
        }

        start() {
            this.x = window.innerWidth * Math.random();
            this.y = -30 * Math.random() - 20;

            this.size = Math.random() * 20 + 15;
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
    }

    class EnemyEnsemble extends GameObject {
        constructor(ensemble = 5){
            super();
            this.enemies = new Array(ensemble).fill({}).map(e=>new Enemy());
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
            for (const enemy of this.enemies) {
                enemy.update(deltaTime, inputManager);
            }
        }

        addEnemy(){
            if(this.enemies.length < 20) {
                this.enemies.push(new Enemy());
            } else {
                for (const enemy of this.enemies) {
                    enemy.minSpeedY += Math.floor( Math.random() * 20 );
                }
            }
        }
    }

    class Food extends GameObject {
        static type = 'food';
        start() {
            this.x = window.innerWidth * Math.random();
            this.y = -30 * Math.random() - 20;

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
            if (this.y - this.radius > window.innerHeight) {
                this.start();
            }
        }
    }
    //#endregion

    //#region Game Logic
    const player = new Player();
    const enemies = new EnemyEnsemble(1);
    const food = new Food();
    const gameManager = new EmptyObject();

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
        points: document.querySelector('#points')
    }

    const soundFx = {
        collect: new Audio('collect.wav'),
        hit: new Audio('hit.wav'),
    }

    const music = new Audio('music.mp3');
    music.loop = true;
    music.volume = 0.3;

    gameManager.updates.push((deltaTime, inputManager)=>{
        if (_collision.collide(player, enemies, deltaTime)) {
            _ctx.fillStyle = "#fff";
            enemies.enemies = [];
            enemies.addEnemy();
            food.start();
            gameData.best = gameData.points > gameData.best? gameData.points: gameData.best;
            window.localStorage.setItem('GAME_DATA.best', gameData.best);
            uiElements.best.textContent = gameData.best;
            uiElements.pauseMenu.classList.add('show');
            soundFx.hit.cloneNode().play();
            objects = [...Particle.burst(player.x, player.y, 15)];
            gameState = GAME_STATES.PAUSED;
        }

        if (_collision.collide(player, food, deltaTime)) {
            objects.push(...Particle.burst(food.x, food.y, 5));
            food.start();
            gameData.points += 1;
            uiElements.points.textContent = gameData.points;  
            enemies.addEnemy();
            _canvas.classList.remove("shake");
            void _canvas.offsetWidth;
            _canvas.classList.add("shake");
            soundFx.collect.cloneNode().play();
        }
    });

    function restartGame(){
        objects = [];
        objects.push(new PlayerTrack(), player, enemies, food, gameManager);
        uiElements.pauseMenu.classList.remove('show');
        uiElements.pauseMenu.classList.remove('first');
        music.play();
        gameData.points = 0;
        gameState = GAME_STATES.PLAYING;
    }

    uiElements.startBtn.addEventListener('click', e=>restartGame());


    //#endregion
})()