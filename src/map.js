'use strict';

const mapSize = 4; // Log2 of the grid size for the 16x16 floor plan
const cellSize = 6; // Size of the rooms
const mapHeight = 7; // Height of the walls
const wallThickness = 0.25; // Wall thickness
const wallRemoval = 0.5; // Random wall removal proportion

const transform = (a, r, tx, ty, o = 1) => a.map((v) => [(o * v[r] + tx) / 2, (o * v[1 - r] + ty) / 2]);

function hilbert(n) {
	if (n === 1) return transform([[0, 0], [0, 1], [1, 1], [1, 0]], 0, 0.5, 0.5);
	const h = hilbert(n - 1);
	return [
		...transform(h, 1, 0, 0),
		...transform(h, 0, 0, 1),
		...transform(h, 0, 1, 1),
		...transform(h, 1, 2, 1, -1)
	];
}

function genBorder(n, w, m) {
	w = 0.5 - w / 4;
	m *= Math.pow(4, n);
	console.time('hilbert');
	const points = hilbert(n);
	console.timeEnd('hilbert');
	// Add points to fix end
	points.unshift(points[3]);
	points.push(points[points.length - 4]);
	// Calculate direction
	console.time('dir');
	let nodes = [];
	for (let i = 0; i < points.length - 2; i++) {
		const p0 = points[i];
		const p1 = points[i + 1];
		const p2 = points[i + 2];
		const d1 = [p1[0] - p0[0], p1[1] - p0[1]];
		const d2 = [p2[0] - p1[0], p2[1] - p1[1]];
		nodes[i] = { p0, p1, p2, s: Math.sign(d1[0] * d2[1] - d1[1] * d2[0]) };
	}
	console.timeEnd('dir');
	// Fix end
	let inverse = nodes.slice(0).reverse();
	inverse = inverse.map(({ p0, p1, p2, s }) => ({ p0: p2, p1, p2: p0, s: -s }));
	if (n % 2) nodes.splice(-3);
	else inverse.splice(0, 3);
	nodes = nodes.concat(inverse);
	// Remove walls
	const removeWall = (r) => {
		if (nodes[r + 1].s === -1 && nodes[r + 2].s === -1) {
			nodes[r].s--;
			nodes[r + 3].s--;
			nodes[r].p2 = nodes[r + 3].p1;
			nodes[r + 3].p0 = nodes[r].p1;
			nodes.splice(r + 1, 2);
		}
	};
	// Remove random walls
	console.time('rnd wall');
	for (let i = 0; i < m; i++) {
		let r = Math.floor(Math.random() * (nodes.length - 3));
		while (nodes[r + 1].s !== -1 || nodes[r + 2].s !== -1) r = (r + 1) % (nodes.length - 3);
		removeWall(r);
	}
	console.timeEnd('rnd wall');
	// Remove bad looking walls
	console.time('pretty wall');
	for (let i = 0; i < nodes.length - 3; i++) {
		if (nodes[i].s === 1 || nodes[i + 3].s === 1) {
			removeWall(i);
		}
	}
	console.timeEnd('pretty wall');
	// Generate borders
	const path = [];
	console.time('border');
	nodes.map(({ p0, p1, p2, s }) => {
		const d1 = [(p1[0] - p0[0]) * w, (p1[1] - p0[1]) * w];
		const d2 = [(p2[0] - p1[0]) * w, (p2[1] - p1[1]) * w];
		if (s === 0) return;
		path.push([p1[0] + s * (d1[0] - d2[0]), p1[1] + s * (d1[1] - d2[1])]);
	});
	console.timeEnd('border');
	// Fix start
	if (n % 2) path.splice(0, 1, path[path.length - 1]);
	else path.splice(-1, 1, path[0]);
	return path;
}

function splitSegments(segments, r, fixedSegments = []) {
	console.time('split segments');
    segments = segments.map(s => {
        // Calculate subsegment length
        let l = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
		const fixed = fixedSegments.some(([a, b]) =>
			Math.hypot(s[0][0] - a[0], s[0][1] - a[1]) < 0.01 &&
			Math.hypot(s[1][0] - b[0], s[1][1] - b[1]) < 0.01
		);
		l = fixed ? 1 : Math.ceil(l / 3.4 - 0.3);
        if (l <= 0) return {parts: [s], seg:s};
        // Lerp coordinates
        let res = [];
        for (let t = 0; t <= 1; t += 1 / l)
            res.push([s[0][0] * (1 - t) + s[1][0] * t, s[0][1] * (1 - t) + s[1][1] * t]);
        // Form pairs of coordinates
        return {
			seg: s,
			parts: res.slice(0, -1).map((r, i) => [r, res[i + 1]])
		};
    });
	console.timeEnd('split segments');
	return segments;
}

// Apply riffle shuffle to sub-arrays
function merge(dest, org, aStart, aEnd, bStart, bEnd) {
    let a = org.slice(aStart, aEnd).reverse();
    let b = org.slice(bStart, bEnd);
    let prop = a.length / b.length;
    while (a.length > 0 && b.length > 0)
        dest.push(a.length / b.length > prop ? a.pop() : b.pop());
    while (a.length > 0) dest.push(a.pop());
    while (b.length > 0) dest.push(b.pop());
    return dest;
};

function reorderPlacements(placements, r) {
    console.time('reorder placements');
    let places = placements;
    placements = [];
    let i = 0, j = places.length - 1;
    let it = [], jt = [], len = 0;
    //console.log(segs);
    //debugger;
    //let temp = [...Array(segs.length)].map((_, i) => i);
    while (i < j) {
        let xi = Math.floor((places[i][0][0] + places[i][1][0]) / 4 / r);
        let yi = Math.floor((places[i][0][1] + places[i][1][1]) / 4 / r);
        let xj = Math.floor((places[j][0][0] + places[j][1][0]) / 4 / r);
        let yj = Math.floor((places[j][0][1] + places[j][1][1]) / 4 / r);
        //console.log(i, j, xi, yi, xj, yj);
        if (xi == xj && yi == yj) {
            //console.log("converge");
            //console.log(temp.slice(i - len, i + 1), temp.slice(j, j + len + 1));
            merge(placements, places, i - len, i + 1, j, j + len + 1);
            it = []; jt = []; len = 0;
        } else {
            //console.log("diverge");
            let findi = jt.findIndex(([x, y]) => x === xi && y === yi);
            let findj = it.findIndex(([x, y]) => x === xj && y === yj);
            //console.log(findi, findj);
            if (findi !== -1) {
                //console.log(temp.slice(i - len, i + 1), temp.slice(j + len - findi, j + len + 1));
                merge(placements, places, i - len, i + 1, j + len - findi, j + len + 1);
                j += len - findi; //rollback
                it = []; jt = []; len = 0;
            } else if (findj !== -1) {
                //console.log(temp.slice(j, j + len + 1), temp.slice(i - len, i - len + findj + 1));
                merge(placements, places, i - len, i - len + findj + 1, j, j + len + 1);
                i -= len - findj; //rollback
                it = []; jt = []; len = 0;
            } else {
                it.push([xi, yi]);
                jt.push([xj, yj]);
                len++;
            }
        }
        i++; j--;
    }
    //console.log(temp.slice(i - len, j + len + 1));
    placements.push(...places.slice(i - len, j + len + 1));
    console.timeEnd('reorder placements');
	return placements;
}

function genGrid(segments, n, r, rooms, featuredSegments) {
	console.time('gen grid');
	let splittedSegments = splitSegments(segments, r, featuredSegments);
	const cellCount = Math.pow(2, n);
	let gridSegs = Array(cellCount * cellCount).fill().map(() => []);
	let gridParts = Array(cellCount * cellCount).fill().map(() => []);
	splittedSegments.map(({seg, parts}) =>
		parts.map(part => {
			const indexes = [
				Math.round(part[0][0] / r - 0.5) +
				Math.round(part[0][1] / r - 0.5) * cellCount,
				Math.round(part[1][0] / r - 0.5) +
				Math.round(part[1][1] / r - 0.5) * cellCount,
				Math.round((part[0][0] + part[1][0]) / 2 / r - 0.5) +
				Math.round((part[0][1] + part[1][1]) / 2 / r - 0.5) * cellCount
			];
			for(let i of indexes) {
				if(!gridSegs[i]) gridSegs[i] = [];
				if(!gridSegs[i].includes(seg)) gridSegs[i].push(seg);
				if(!gridParts[i]) gridParts[i] = [];
				if(!gridParts[i].includes(part)) gridParts[i].push(part);
			}
		})
	);
	//console.log(gridSegs, gridParts);
	const getNearbyItems = (grid, x, y) => {
		const cellX = Math.round(x / r - 0.5);
		const cellY = Math.round(y / r - 0.5);
		const nearby = new Set();
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				const xIndex = cellX + dx;
				const yIndex = cellY + dy;
				if (xIndex < 0 || xIndex >= cellCount || yIndex < 0 || yIndex >= cellCount) continue;
				for (const item of grid[xIndex + yIndex * cellCount] || []) nearby.add(item);
			}
		}
		return [...nearby];
	};
	const getGridSegments = (x, y) => getNearbyItems(gridSegs, x, y);
	const getGridParts = (x, y) => getNearbyItems(gridParts, x, y);
	let placements = splittedSegments.flatMap(({parts}) => parts);
	// Ignore short segments for painting placement
	placements = placements.filter(([[ax, ay], [bx, by]]) => Math.hypot(ax - bx, ay - by) > 1);
	placements = reorderPlacements(placements, r);
	const center = cellCount * r / 2;
	placements.sort((a, b) => {
		const distanceA = Math.hypot((a[0][0] + a[1][0]) / 2 - center, (a[0][1] + a[1][1]) / 2 - center);
		const distanceB = Math.hypot((b[0][0] + b[1][0]) / 2 - center, (b[0][1] + b[1][1]) / 2 - center);
		return distanceA - distanceB;
	});
	const featuredPlacements = featuredSegments
		.map((featuredSegment, index) => placements.find(([[ax, az], [bx, bz]]) => {
			const sameDirection =
				Math.hypot(ax - featuredSegment[0][0], az - featuredSegment[0][1]) < 0.01 &&
				Math.hypot(bx - featuredSegment[1][0], bz - featuredSegment[1][1]) < 0.01;
			const oppositeDirection =
				Math.hypot(ax - featuredSegment[1][0], az - featuredSegment[1][1]) < 0.01 &&
				Math.hypot(bx - featuredSegment[0][0], bz - featuredSegment[0][1]) < 0.01;
			return sameDirection || oppositeDirection;
		}) || (index >= 3 ? featuredSegment : null))
		.filter(Boolean);
	const featuredSet = new Set(featuredPlacements);
	placements = [...featuredPlacements, ...placements.filter(segment => !featuredSet.has(segment))];
	const roomIndexOf = (segment) => {
		const x = (segment[0][0] + segment[1][0]) / 2;
		const z = (segment[0][1] + segment[1][1]) / 2;
		return rooms.findIndex(room =>
			x >= room.left && x <= room.right && z >= room.top && z <= room.bottom
		);
	};
	const roomPlacementLimits = [3, 6, 14, 14, 14, 14, 14, 12];
	const roomCandidates = Array.from({length: rooms.length}, () => []);
	placements.forEach((segment, index) => {
		const roomIndex = roomIndexOf(segment);
		if (roomIndex !== -1) roomCandidates[roomIndex].push({segment, index});
	});
	placements = roomCandidates.flatMap((candidates, roomIndex) => {
		const pinned = candidates.filter(item => featuredSet.has(item.segment));
		const sideBuckets = [[], [], [], []];
		for (const item of candidates) {
			if (featuredSet.has(item.segment)) continue;
			const [[x1, z1], [x2, z2]] = item.segment;
			const x = (x1 + x2) / 2;
			const z = (z1 + z2) / 2;
			const room = rooms[roomIndex];
			const horizontal = Math.abs(z2 - z1) < 0.01;
			const side = horizontal
				? (Math.abs(z - room.top) < Math.abs(z - room.bottom) ? 2 : 3)
				: (Math.abs(x - room.left) < Math.abs(x - room.right) ? 0 : 1);
			if (roomIndex === 1 && side === 3) continue;
			item.order = horizontal ? x : z;
			sideBuckets[side].push(item);
		}
		sideBuckets.forEach(side => side.sort((a, b) => a.order - b.order || a.index - b.index));
		const selected = [...pinned];
		const sideQuotas = [0, 0, 0, 0];
		let remaining = roomPlacementLimits[roomIndex] - selected.length;
		while (remaining > 0) {
			let added = false;
			for (let sideIndex = 0; sideIndex < sideBuckets.length && remaining > 0; sideIndex++) {
				if (sideQuotas[sideIndex] < sideBuckets[sideIndex].length) {
					sideQuotas[sideIndex]++;
					remaining--;
					added = true;
				}
			}
			if (!added) break;
		}
		sideBuckets.forEach((side, sideIndex) => {
			const count = sideQuotas[sideIndex];
			if (count === 1) {
				selected.push(side[Math.floor((side.length - 1) / 2)]);
				return;
			}
			for (let index = 0; index < count; index++) {
				const position = Math.round(index * (side.length - 1) / (count - 1));
				selected.push(side[position]);
			}
		});
		return selected.map(item => item.segment);
	});
	const areas = placements.map(place => [
        (Math.round((place[0][0] + place[1][0]) / 2 / r + 0.5) - 0.5) * r,
        (Math.round((place[0][1] + place[1][1]) / 2 / r + 0.5) - 0.5) * r
	]);
	const getAreaIndex = (x, y) => {
		let index = areas.findIndex(a => Math.abs(a[0] - x) < r / 2 && Math.abs(a[1] - y) < r / 2)
		if (index === -1) // Middle of room => search neighbour cells
			index = areas.findIndex(a => Math.abs(a[0] - x) + Math.abs(a[1] - y) < r)
		if (index === -1) {
			index = areas.reduce((closest, area, i) => {
				const distance = Math.hypot(area[0] - x, area[1] - y);
				return distance < closest.distance ? {index: i, distance} : closest;
			}, {index: -1, distance: Infinity}).index;
		}
		return index;
	};
	console.timeEnd('gen grid');
	return {getGridSegments, getGridParts, getAreaIndex, placements};
}

function genGallerySegments(r) {
	const cells = new Set();
	const addCell = (x, z) => cells.add(`${x},${z}`);
	const addRoom = (x0, z0, size) => {
		for (let z = z0; z < z0 + size; z++) {
			for (let x = x0; x < x0 + size; x++) addCell(x, z);
		}
	};

	addRoom(1, 1, 3);
	addRoom(12, 1, 3);
	addRoom(1, 12, 3);
	addRoom(12, 12, 3);
	addRoom(5, 5, 6); // Central lobby
	addRoom(1, 6, 3);
	addRoom(12, 6, 3);

	[
		[4, 2], [4, 3], [4, 4], [4, 5], // Northwest
		[11, 2], [11, 3], [11, 4], [11, 5], // Northeast
		[4, 7], [11, 7], // Side rooms
		[4, 13], [4, 12], [4, 11], [4, 10], // Southwest
		[11, 13], [11, 12], [11, 11], [11, 10] // Southeast
	].forEach(([x, z]) => addCell(x, z));

	const hasCell = (x, z) => cells.has(`${x},${z}`);
	let segments = [];
	for (const cell of cells) {
		const [x, z] = cell.split(',').map(Number);
		const left = x * r;
		const top = z * r;
		const right = left + r;
		const bottom = top + r;
		if (!hasCell(x, z - 1)) segments.push([[left, top], [right, top]]);
		if (!hasCell(x + 1, z)) segments.push([[right, top], [right, bottom]]);
		if (!hasCell(x, z + 1)) segments.push([[right, bottom], [left, bottom]]);
		if (!hasCell(x - 1, z)) segments.push([[left, bottom], [left, top]]);
	}
	const roomSize = 8;
	const roomCenter = 8 * r;
	const roomLeft = roomCenter - roomSize / 2;
	const roomRight = roomCenter + roomSize / 2;
	const roomSouth = roomSize;
	const tunnelLeft = roomCenter - 2;
	const tunnelRight = roomCenter + 2;
	const lobbyNorth = 5 * r;
	const lobbySouth = 11 * r;
	const mainWall = [[roomCenter + 3.2, lobbySouth], [roomCenter - 3.2, lobbySouth]];
	const wallLeft = roomCenter - 3.2;
	const wallRight = roomCenter + 3.2;
	const leftWallLength = wallLeft - 5 * r;
	const rightWallLength = 11 * r - wallRight;
	const leftWallSegments = [];
	for (let index = 0; index < 2; index++) {
		const near = wallLeft - index * leftWallLength / 4;
		const far = wallLeft - (index + 1) * leftWallLength / 4;
		leftWallSegments.push([[near, lobbySouth], [far, lobbySouth]]);
	}
	const rightNear = [[wallRight + rightWallLength / 4, lobbySouth], [wallRight, lobbySouth]];
	const rightFar = [[wallRight + rightWallLength / 2, lobbySouth], [wallRight + rightWallLength / 4, lobbySouth]];
	const sideWallSegments = [leftWallSegments[0], leftWallSegments[1], rightNear, rightFar];
	const rooms = [
		{name: 'Teclas', left: roomLeft, right: roomRight, top: 0, bottom: roomSouth},
		{name: 'Lobby', left: 5 * r, right: 11 * r, top: lobbyNorth, bottom: lobbySouth},
		{name: 'Cuarto 1', left: r, right: 4 * r, top: r, bottom: 4 * r},
		{name: 'Cuarto 2', left: 12 * r, right: 15 * r, top: r, bottom: 4 * r},
		{name: 'Cuarto 3', left: r, right: 4 * r, top: 12 * r, bottom: 15 * r},
		{name: 'Cuarto 4', left: 12 * r, right: 15 * r, top: 12 * r, bottom: 15 * r},
		{name: 'Cuarto 5', left: r, right: 4 * r, top: 6 * r, bottom: 9 * r},
		{name: 'Cuarto 6', left: 12 * r, right: 15 * r, top: 6 * r, bottom: 9 * r}
	];
	segments = segments.flatMap((segment) => {
		const [[x1, z1], [x2, z2]] = segment;
		if (z1 !== lobbyNorth || z2 !== lobbyNorth || x1 === x2) return [segment];
		const left = Math.min(x1, x2);
		const right = Math.max(x1, x2);
		if (right <= tunnelLeft || left >= tunnelRight) return [segment];
		const remainingWalls = [];
		if (left < tunnelLeft) remainingWalls.push([[left, lobbyNorth], [tunnelLeft, lobbyNorth]]);
		if (right > tunnelRight) remainingWalls.push([[tunnelRight, lobbyNorth], [right, lobbyNorth]]);
		return remainingWalls;
	});
	segments.push(
		[[roomLeft, 0], [roomRight, 0]],
		[[roomLeft, roomSouth], [roomLeft, 0]],
		[[roomRight, 0], [roomRight, roomSouth]],
		[[tunnelLeft, roomSouth], [roomLeft, roomSouth]],
		[[roomRight, roomSouth], [tunnelRight, roomSouth]],
		[[tunnelLeft, lobbyNorth], [tunnelLeft, roomSouth]],
		[[tunnelRight, roomSouth], [tunnelRight, lobbyNorth]]
	);
	segments = segments.flatMap(segment => {
		const [[x1, z1], [x2, z2]] = segment;
		if (Math.abs(z1 - lobbySouth) > 0.01 || Math.abs(z2 - lobbySouth) > 0.01 || x1 === x2) return [segment];
		const cuts = [...sideWallSegments, mainWall]
			.flatMap(([a, b]) => [a[0], b[0]])
			.filter(x => x > Math.min(x1, x2) + 0.01 && x < Math.max(x1, x2) - 0.01)
			.filter((x, index, values) => values.indexOf(x) === index)
			.sort((a, b) => x1 > x2 ? b - a : a - b);
		const points = [x1, ...cuts, x2];
		return points.slice(0, -1).map((x, index) => [[x, z1], [points[index + 1], z2]]);
	});
	return {
		segments,
		rooms,
		featuredSegments: [
			[[roomLeft, 0], [roomRight, 0]],
			[[roomLeft, roomSouth], [roomLeft, 0]],
			[[roomRight, 0], [roomRight, roomSouth]],
			mainWall,
			...sideWallSegments
		]
	};
}

module.exports = function (n = mapSize, r = cellSize, w = wallThickness, m = wallRemoval, h = mapHeight) {
	let s = r * Math.pow(2, n);
	console.time('gen mesh');
	let {segments, rooms, featuredSegments} = genGallerySegments(r);
	let normal = segments
		.map(([[x1, y1], [x2, y2]]) => [Math.sign(y1 - y2), 0, Math.sign(x2 - x1)])
		.flatMap((v) => Array(4).fill(v));
	let position = segments.flat().flatMap(([x, y]) => [[x, 0, y], [x, h, y]]);
	let {getAreaIndex, getGridSegments, getGridParts, placements} = genGrid(segments, n, r, rooms, featuredSegments);
	//Add floor and ceilling
	normal.push([0, -1, 0], [0, -1, 0], [0, -1, 0], [0, -1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]);
	position.push([0, h, 0], [0, h, s], [s, h, 0], [s, h, s], [0, 0, 0], [s, 0, 0], [0, 0, s], [s, 0, s]);
	let elements = Array(position.length / 4)
		.fill()
		.flatMap((_, i) => [i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3]);
	console.timeEnd('gen mesh');
    console.log(placements.length + " available painting placements");
	return {
		placements,
		getAreaIndex,
		getGridSegments,
		getGridParts,
		position,
		normal,
		elements
	};
};
