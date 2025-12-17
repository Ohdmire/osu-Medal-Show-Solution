// ==UserScript==
// @name         osu! Medal Show Solution
// @namespace    https://github.com/Ohdmire
// @description  show medal solution panel using Osekai
// @author       ATRI1024
// @version      1.0
// @match        https://osu.ppy.sh/*
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @connect      inex.osekai.net
// @license      GPL-3.0
// ==/UserScript==

(() => {
    'use strict';

    const STORAGE_KEY = 'osu_medal_solution_cache';
    let medalMap = new Map();
    let floatingBox = null;
    let pinned = false;

    /* -------------------------
     * WaitForElement: DOM Ready
     * ------------------------- */
    function WaitForElement(selector, callback, interval = 200, timeout = 5000) {
        const start = Date.now();
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                callback(el);
            } else if (Date.now() - start > timeout) {
                clearInterval(timer);
                console.warn(`WaitForElement: Timeout waiting for ${selector}`);
            }
        }, interval);
    }

    /* -------------------------
     * Load & Cache Medal Data
     * ------------------------- */
    function loadCache() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);
            medalMap = new Map(data);
            console.log('[Medal] Loaded from cache:', medalMap.size);
            return true;
        } catch {
            return false;
        }
    }

    function saveCache() {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify([...medalMap.entries()])
        );
    }

    function fetchMedals(force = false) {
        if (!force && loadCache()) return;

        console.log('[Medal] Fetching medal preload…');

        GM_xmlhttpRequest({
            method: 'GET',
            url: 'https://inex.osekai.net/medals/',
            onload(res) {
                const match = res.responseText.match(
                    /const medals_preload\s*=\s*(\{[\s\S]*?\});/
                );

                if (!match) {
                    console.error('[Medal] preload not found');
                    return;
                }

                const preload = JSON.parse(match[1]);

                medalMap.clear();
                preload.content.forEach(m => {
                    medalMap.set(
                        m.Name,
                        m.Solution || 'No solution available.'
                    );
                });

                saveCache();
                console.log('[Medal] Cached medals:', medalMap.size);
            },
        });
    }

    /* -------------------------
     * Floating Window
     * ------------------------- */
    function createFloatingBox() {
        if (floatingBox) return;

        floatingBox = document.createElement('div');
        floatingBox.style.cssText = `
            position: fixed;
            right: 20px;
            bottom: 20px;
            width: 300px;
            background: #111;
            color: #fff;
            padding: 12px;
            border-radius: 8px;
            font-size: 13px;
            z-index: 99999;
            box-shadow: 0 6px 20px rgba(0,0,0,.4);
            display: none;
        `;

        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        `;

        const title = document.createElement('span');
        title.textContent = 'Medal Solution';

        const actions = document.createElement('div');

        const link = document.createElement('a');
        link.textContent = '↗';
        link.style.cssText = 'color:#aaa;margin-right:8px;';
        link.target = '_blank';

        const close = document.createElement('span');
        close.textContent = '✕';
        close.style.cursor = 'pointer';
        close.onclick = () => {
            floatingBox.style.display = 'none';
            pinned = false;
        };

        actions.append(link, close);
        header.append(title, actions);

        const body = document.createElement('div');
        body.id = 'medal-body';

        floatingBox.append(header, body);
        document.body.appendChild(floatingBox);

        floatingBox._body = body;
        floatingBox._link = link;
    }

    function showFloating(name, text, pin = false) {
        createFloatingBox();

        floatingBox._body.innerHTML = text;

        floatingBox._body.querySelectorAll('img').forEach(img => {
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.objectFit = 'contain';
      });

        floatingBox._link.href =
            'https://inex.osekai.net/medals/' + encodeURIComponent(name);

        floatingBox.style.display = 'block';
        pinned = pin;
    }

    /* -------------------------
     * Medal Injection
     * ------------------------- */
    function scan() {
        document
            .querySelectorAll('img.badge-achievement__image:not([data-ready])')
            .forEach(img => {
                img.dataset.ready = '1';

                const name = img.alt;
                if (!medalMap.has(name)) return;

                img.style.cursor = 'pointer';

                img.addEventListener('mouseenter', () => {
                    if (!pinned)
                        showFloating(name, medalMap.get(name));
                });

                img.addEventListener('mouseleave', () => {
                    if (!pinned) floatingBox.style.display = 'none';
                });

                img.addEventListener('click', e => {
                    e.preventDefault();
                    pinned = true;
                    showFloating(name, medalMap.get(name), true);
                });
            });
    }

    /* -------------------------
     * Turbo Event Listener (SPA)
     * ------------------------- */
    function run() {
        if (!window.location.pathname.startsWith('/users/')) {
            return;
        }

        floatingBox = null;

        WaitForElement('img.badge-achievement__image', () => {
            scan();
        });
    }

    /* -------------------------
     * Turbo Event
     * ------------------------- */
    function handleTurboLeave() {
        pinned = false;

        if (floatingBox && floatingBox.style.display === 'block') {
            floatingBox.style.display = 'none';
        }

        console.log('[Medal] Turbo is leaving, set pinned status.');
    }

    document.addEventListener('turbo:load', run);
    document.addEventListener('turbo:before-visit', handleTurboLeave);
    // document.addEventListener('turbo:before-cache', handleTurboLeave);

    /* -------------------------
     * Menu Command
     * ------------------------- */
    GM_registerMenuCommand('Refresh Medal Cache', () => {
        localStorage.removeItem(STORAGE_KEY);
        fetchMedals(true);
        alert('Medal cache refreshed');
    });

    /* -------------------------
     * Boot
     * ------------------------- */
    fetchMedals();
    run();
})();