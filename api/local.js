'strict mode';

// Local images
const featuredOrder = [
    "teclas (1).jpg", "Teclas 2.png", "Mapa.png",
    "Feliz cumpleaños Mi Lau.png", "pastel.png"
];
const images = require("../images/images.json").images
    .slice()
    .sort((a, b) => {
        const aIndex = featuredOrder.indexOf(a.file);
        const bIndex = featuredOrder.indexOf(b.file);
        if (aIndex !== bIndex) {
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
        }
        return a.file.localeCompare(b.file, undefined, {numeric: true});
    })
    .map((img,i)=>{
        const placementIndex = featuredOrder.indexOf(img.file);
        return {
            ...img,
            image_id:i,
            ...(placementIndex >= 0 ? {placementIndex} : {})
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