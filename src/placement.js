'use strict';
const texture = require('./image');
const mat4 = require('gl-mat4');
const vec3 = require('gl-vec3');

const renderDist = 12;
const loadDist = 16;
const unloadDist = 18;
const fovxMargin = Math.PI/32;

const dynamicResPeriod = 3000;
let dynamicRes = "high";
let dynamicResTimer;

const culling = (ppos, pangle, fovx, {vseg, angle}) => {
    const sx1 = vseg[0][0] - ppos[0];
    const sy1 = vseg[0][1] - ppos[2];
    const sx2 = vseg[1][0] - ppos[0];
    const sy2 = vseg[1][1] - ppos[2];
    const angles = [angle, pangle - fovx/2 - fovxMargin + Math.PI/2, pangle + fovx/2 + fovxMargin - Math.PI/2];
    for(let a of angles) {
        const nx = Math.sin(a);
        const ny = -Math.cos(a);
        if(nx * sx1 + ny * sy1 < 0 && nx * sx2 + ny * sy2 < 0)
            return false;
    }
    return true;
};

const pointInTriangle = (point, a, b, c) => {
    const cross = (origin, end, target) =>
        (target[0] - origin[0]) * (end[1] - origin[1]) -
        (target[1] - origin[1]) * (end[0] - origin[0]);
    const first = cross(a, b, point);
    const second = cross(b, c, point);
    const third = cross(c, a, point);
    return !((first < 0 || second < 0 || third < 0) && (first > 0 || second > 0 || third > 0));
};

module.exports = (regl, {placements, getAreaIndex}) => {
    //console.log(areas);
    let batch = [], shownBatch = [];
    let fetching = true;
    const loadPainting = (p) => {
        const placementIndex = Number.isInteger(p.placementIndex) ? p.placementIndex : batch.length;
        const seg = placements[placementIndex];
        // Calculate painting position, direction, normal angle and scale
        const dir = [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]];
        const norm = [seg[1][1] - seg[0][1], seg[0][0] - seg[1][0]];
        const segLen = Math.hypot(dir[0], dir[1]);
        const baseScale = Math.min(4.5 / (3 + p.aspect), segLen / p.aspect / 2.2, 2 / 1.2);
        const partyFiles = ["Feliz cumpleaños Mi Lau.png", "pastel.png"];
        const isPartyImage = partyFiles.includes(p.file);
        const isBirthday = p.file === "Feliz cumpleaños Mi Lau.png";
        const isCake = p.file === "pastel.png";
        const isTeclasImage = ["teclas (1).jpg", "Teclas 2.png", "Mapa.png"].includes(p.file);
        const isFeaturedSideImage = ["56.jpeg", "57.jpeg", "85.jpeg", "87.jpeg"].includes(p.file);
        const isRoomArtwork = placementIndex >= 8;
        const baseHeightScale = baseScale * (isCake ? 0.9 : placementIndex < 3 ? 1.2 : 1);
        const baseWidth = (isCake ? baseHeightScale : baseScale * 1.2) * p.aspect;
        const heightScale = baseHeightScale * (isCake ? 1.4 : isBirthday ? 1.1 : isTeclasImage ? 1 : isFeaturedSideImage ? 1.2 : isRoomArtwork ? 1.65 : 1);
        const requestedWidth = baseWidth * (isCake ? 1.4 : isBirthday ? 1.65 : isRoomArtwork ? 1.35 : 1);
        const width = Math.min(requestedWidth, segLen * 0.48);
        const verticalCenter = isCake ? 1.85 : isBirthday ? 4.9 : isPartyImage ? 4.5 : isTeclasImage ? 2.1 : heightScale + 1.1;
        const pos = [(seg[0][0] + seg[1][0]) / 2, verticalCenter - heightScale, (seg[0][1] + seg[1][1]) / 2];
        const angle = Math.atan2(dir[1], dir[0]);
        const horiz = Math.abs(angle % 3) < 1 ? 1 : 0;
        const vert = 1 - horiz;
        const thickness = isPartyImage ? 0.025 : 0.1;
        const scale = [
            2 * width * horiz + thickness * vert,
            2 * heightScale,
            2 * width * vert + thickness * horiz];
        const text = p.textGen(width);
        const d1 = width / segLen;
        const d2 = 0.005 / Math.hypot(norm[0], norm[1]);
        // Visible painting segment for culling
        const vseg = [
            [pos[0] - dir[0] * d1 * 2, pos[2] - dir[1] * d1],
            [pos[0] + dir[0] * d1 * 2, pos[2] + dir[1] * d1]
        ];
        // Offset pos to account for painting width and depth
        pos[0] -= dir[0] * d1 + norm[0] * d2;
        pos[2] -= dir[1] * d1 + norm[1] * d2;
        // Calculate model matrix
        const model = [];
        mat4.fromTranslation(model, pos);
        mat4.scale(model, model, scale);
        mat4.rotateY(model, model, -angle);
        const textmodel = [];
        mat4.fromTranslation(textmodel, [pos[0], Math.max(0.75, 1.7 - heightScale), pos[2]]);
        batch.push({ ...p, vseg, angle, model, textmodel, text, width, textGen:null });
    };

    const fetchPaintings = (count, onComplete) => {
        const loadedPaintings = [];
        texture.fetch(regl, count, dynamicRes, painting => loadedPaintings.push(painting), () => {
            loadedPaintings
                .sort((a, b) => a.placementIndex - b.placementIndex)
                .forEach(loadPainting);
            onComplete();
        });
    };

    // Fetch the first textures
    fetchPaintings(20, () => fetching = false);
    return {
        hitTest: (x, y, viewProjection) => {
            let nearestDepth = Infinity;
            let nearestPainting = null;
            for (const painting of shownBatch) {
                const vertices = [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]].map(vertex => {
                    const world = vec3.transformMat4([], vertex, painting.model);
                    return vec3.transformMat4([], world, viewProjection);
                });
                if (vertices.some(vertex => vertex[2] < -1 || vertex[2] > 1)) continue;
                const point = [x, y];
                if (!pointInTriangle(point, vertices[0], vertices[1], vertices[2]) &&
                    !pointInTriangle(point, vertices[3], vertices[2], vertices[1])) continue;
                const depth = vertices.reduce((sum, vertex) => sum + vertex[2], 0) / vertices.length;
                if (depth >= nearestDepth) continue;
                nearestDepth = depth;
                nearestPainting = painting;
            }
            return nearestPainting;
        },
        update: (pos, angle, fovX) => {
            // Estimate player position index
            let index = getAreaIndex(pos[0], pos[2], 4);
            if (index === -1) return; // Out of bound => do nothing
            const smallBatch = batch.length <= renderDist * 2;
            if (!smallBatch) {
                batch.slice(0, Math.max(0, index - unloadDist)).map(t => texture.unload(t));
                batch.slice(index + unloadDist).map(t => texture.unload(t));
            }
            // Load close textures
            shownBatch = batch.slice(smallBatch ? 0 : Math.max(0, index - renderDist), smallBatch ? batch.length : index + renderDist);
            shownBatch.map(t => texture.load(regl, t, dynamicRes));
            // Frustum / Orientation culling
            shownBatch = shownBatch.filter(t => t.tex && culling(pos, angle, fovX, t));
            // Fetch new textures
            if (index <= batch.length - loadDist) return;
            if (!fetching) {
                fetching = true;
                fetchPaintings(5, () => fetching = false);
            }
            // Update dynamic resolution
            dynamicRes = "low";
            if (dynamicResTimer) clearTimeout(dynamicResTimer);
            dynamicResTimer = setTimeout(() => dynamicRes = "high", dynamicResPeriod);
        },
        batch: () => shownBatch
    };
};