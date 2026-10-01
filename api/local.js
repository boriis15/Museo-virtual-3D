'strict mode';

// Local images
const featuredOrder = [
    "teclas (1).jpg", "Teclas 2.png", "Mapa.png",
    "Feliz cumpleaños Mi Lau.png", "pastel.png"
];
const mainWallNumbers = [56, 57, 85, 87];
const lobbyWallNumbers = [2, 3, 60, 16, 17, 74];
const roomOrder = (image) => {
    const featuredIndex = featuredOrder.indexOf(image.file);
    if (featuredIndex >= 0) return featuredIndex < 3 ? 0 : 1;

    const match = /^imagen (\d+)$/i.exec(image.title);
    const imageNumber = match ? Number(match[1]) : null;
    if (imageNumber === null) return 1;
    if (imageNumber === 1) return 7;
    if (mainWallNumbers.includes(imageNumber) || lobbyWallNumbers.includes(imageNumber)) return 1;
    if (imageNumber <= 15) return 2;
    if (imageNumber <= 29) return 3;
    if (imageNumber <= 43) return 4;
    if (imageNumber <= 55 || imageNumber === 58 || imageNumber === 59) return 5;
    if (imageNumber <= 73) return 6;
    return 7;
};
const placementStarts = [0, 14, 14, 26, 38, 52, 66, 79];
const roomPlacementCounts = Array(placementStarts.length).fill(0);
const images = require("../images/images.json").images
    .slice()
    .sort((a, b) => {
        const aRoom = roomOrder(a);
        const bRoom = roomOrder(b);
        if (aRoom !== bRoom) return aRoom - bRoom;

        const aFeatured = featuredOrder.indexOf(a.file);
        const bFeatured = featuredOrder.indexOf(b.file);
        if (aFeatured !== bFeatured) {
            if (aFeatured === -1) return 1;
            if (bFeatured === -1) return -1;
            return aFeatured - bFeatured;
        }

        const aNumber = Number((/^imagen (\d+)$/i.exec(a.title) || [])[1]);
        const bNumber = Number((/^imagen (\d+)$/i.exec(b.title) || [])[1]);
        const aWallOrder = mainWallNumbers.indexOf(aNumber);
        const bWallOrder = mainWallNumbers.indexOf(bNumber);
        if (aWallOrder !== bWallOrder) {
            if (aWallOrder === -1) return 1;
            if (bWallOrder === -1) return -1;
            return aWallOrder - bWallOrder;
        }
        const aLobbyWallOrder = lobbyWallNumbers.indexOf(aNumber);
        const bLobbyWallOrder = lobbyWallNumbers.indexOf(bNumber);
        if (aLobbyWallOrder !== bLobbyWallOrder) {
            if (aLobbyWallOrder === -1) return 1;
            if (bLobbyWallOrder === -1) return -1;
            return aLobbyWallOrder - bLobbyWallOrder;
        }
        if (aNumber && bNumber && aNumber !== bNumber) return aNumber - bNumber;
        return a.file.localeCompare(b.file, undefined, {numeric: true});
    })
    .map((img,i)=>{
        const room = roomOrder(img);
        const sharesMainWall = img.file === "Feliz cumpleaños Mi Lau.png" || img.file === "pastel.png";
        const imageNumber = Number((/^imagen (\d+)$/i.exec(img.title) || [])[1]);
        const mainWallIndex = mainWallNumbers.indexOf(imageNumber);
        const lobbyWallIndex = lobbyWallNumbers.indexOf(imageNumber);
        const placementIndex = sharesMainWall ? 3 : mainWallIndex !== -1
            ? 4 + mainWallIndex
            : lobbyWallIndex !== -1
            ? 8 + lobbyWallIndex
            : placementStarts[room] + roomPlacementCounts[room]++;
        return {
            ...img,
            image_id:i,
            placementIndex
        };
    });
module.exports = {
    fetchList: async function (from, count) {
        return images.slice(from, from + count);//.map((img,i)=>({...img, image_id:i+from}));
    },
    fetchImage: async function (obj, advicedResolution) {
        const url = "images/" + obj.file;
        const blob = await fetch(url).then(res => res.blob());
        return {
            title: obj.title,
            image: blob
        };
    }
};