'use strict';

const mat4 = require('gl-mat4');

var useReflexion = true;
var showStats = false;

// Handle different screen ratios
const mapVal = (value, min1, max1, min2, max2) => min2 + (value - min1) * (max2 - min2) / (max1 - min1);
var fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.7, Math.PI / 3);

if (navigator.userAgent.match(/(iPad)|(iPhone)|(iPod)|(android)|(webOS)/i)) {
	useReflexion = false;
	// Account for the searchbar
	fovX = () => mapVal(window.innerWidth / window.innerHeight, 16/9, 9/16, 1.5, Math.PI / 3);
}
var fovY = () => 2 * Math.atan(Math.tan(fovX() * 0.5) * window.innerHeight / window.innerWidth);

const Stats = require('stats.js');
var stats = new Stats();
stats.showPanel(0);
if(showStats) {
	document.body.appendChild( stats.dom );
}

let regl, map, drawMap, placement, drawPainting, fps;

regl = require('regl')({
	extensions: [
		//'angle_instanced_arrays',
		'OES_element_index_uint',
		'OES_standard_derivatives'
	],
	optionalExtensions: [
		//'oes_texture_float',
		'EXT_texture_filter_anisotropic'
	],
	attributes: { alpha : false }
});

map = require('./map')();
const mesh = require('./mesh');
drawMap = mesh(regl, map, useReflexion);
placement = require('./placement')(regl, map);
drawPainting = require('./painting')(regl);
fps = require('./fps')(map, fovY);

const detailsStyle = document.createElement('style');
detailsStyle.textContent = `
	#artwork-details {
		position: fixed;
		z-index: 10;
		left: 50%;
		top: 50%;
		box-sizing: border-box;
		width: min(360px, calc(100vw - 32px));
		max-height: calc(100vh - 32px);
		overflow: auto;
		transform: translate(-50%, -50%);
		padding: 20px 56px 20px 20px;
		color: #1c2926;
		background: #f2eee3;
		border-top: 3px solid #2b8575;
		box-shadow: 0 12px 36px rgba(0, 0, 0, 0.4);
		font: 14px/1.5 system-ui, sans-serif;
	}
	#artwork-details[hidden] { display: none; }
	#artwork-details h2 {
		margin: 0 0 8px;
		font: 22px/1.2 Georgia, serif;
	}
	#artwork-details p { margin: 4px 0 0; }
	#artwork-details .artwork-meta { color: #53635e; font-size: 12px; }
	#artwork-details .artwork-description { color: #1c2926; }
	#artwork-details button {
		position: absolute;
		top: 12px;
		right: 12px;
		border: 0;
		padding: 7px 9px;
		color: #1c2926;
		background: transparent;
		font: inherit;
		cursor: pointer;
	}
`;
document.head.appendChild(detailsStyle);

const artworkDetails = document.createElement('aside');
artworkDetails.id = 'artwork-details';
artworkDetails.hidden = true;
artworkDetails.setAttribute('aria-live', 'polite');
const artworkTitle = document.createElement('h2');
const artworkArtist = document.createElement('p');
const artworkDescription = document.createElement('p');
artworkDescription.className = 'artwork-description';
artworkDescription.hidden = true;
const artworkMeta = document.createElement('p');
artworkMeta.className = 'artwork-meta';
const closeDetails = document.createElement('button');
closeDetails.type = 'button';
closeDetails.textContent = 'Cerrar';
closeDetails.setAttribute('aria-label', 'Cerrar información de la obra');
closeDetails.setAttribute('aria-keyshortcuts', 'X Escape');
closeDetails.addEventListener('click', () => { artworkDetails.hidden = true; });
artworkDetails.append(artworkTitle, artworkArtist, artworkDescription, artworkMeta, closeDetails);
document.body.appendChild(artworkDetails);

const hitPainting = (event) => {
	const canvas = regl._gl.canvas;
	const bounds = canvas.getBoundingClientRect();
	const locked = Boolean(document.pointerLockElement);
	const x = locked ? 0 : 2 * (event.clientX - bounds.left) / bounds.width - 1;
	const y = locked ? 0 : 1 - 2 * (event.clientY - bounds.top) / bounds.height;
	const viewProjection = mat4.multiply([], fps.proj(), fps.view());
	return placement.hitTest(x, y, viewProjection);
};

document.addEventListener('click', (event) => {
	if (artworkDetails.contains(event.target)) return;
	if (event.target !== regl._gl.canvas && !document.pointerLockElement) return;
	const painting = hitPainting(event);
	if (!painting) return;
	artworkTitle.textContent = painting.title || 'Obra sin título';
	artworkArtist.textContent = painting.artist_title || 'Colección local';
	artworkDescription.textContent = painting.description || '';
	artworkDescription.hidden = !painting.description;
	artworkMeta.textContent = [painting.date_display, painting.medium_display].filter(Boolean).join(' | ');
	artworkDetails.hidden = false;
});

window.addEventListener('keydown', (event) => {
	if ((event.key === 'Escape' || event.code === 'KeyX') && !artworkDetails.hidden) {
		event.preventDefault();
		artworkDetails.hidden = true;
	}
});

const context = regl({
	cull: {
		enable: true,
		face: 'back'
	},
	uniforms: {
		view: fps.view,
		proj: fps.proj,
		yScale: 1.0
	}
});

const reflexion = regl({
	cull: {
		enable: true,
		face: 'front'
	},
	uniforms: {
		yScale: -1.0
	}
});

regl.frame(({
	time
}) => {
	stats.begin();
	fps.tick({
		time
	});
	placement.update(fps.pos, fps.fmouse[1], fovX());
	regl.clear({
		color: [0, 0, 0, 1],
		depth: 1
	});
	context(() => {
		if(useReflexion) {
			reflexion(() => {
				drawMap();
				drawPainting(placement.batch());
			});
		}
		drawMap();
		drawPainting(placement.batch());
	});
	stats.end();
});