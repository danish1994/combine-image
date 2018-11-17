import isPlainObj from 'is-plain-obj';
import Jimp, {read} from 'jimp';
import calcMargin from './utils/calcMargin';

export default async function combineImage(images, {
    direction = 'col',
    color = 0x00000000,
    offset = 0,
    margin,
    shrink = true
} = {}) {
    if (!Array.isArray(images)) {
        throw new TypeError('`images` must be an array that contains images');
    }

    if (images.length < 1) {
        throw new Error('At least `images` must contain more than one image');
    }

    const processImg = (img) => {
        if (isPlainObj(img)) {
            const {src} = img;

            return read(src)
                .then((imgObj) => ({
                    img: imgObj,
                }));
        }

        return read(img).then((imgObj) => ({img: imgObj}));
    };

    direction = (direction === 'row');
    const minMaxFunc = shrink ? 'min' : 'max';

    let imgs = await Promise.all(images.map(processImg));

    let imgData = imgs.reduce((res, {img}) => {
        const {bitmap: {width, height}} = img;

        res.push({
            img,
            width,
            height
        });

        return res;
    }, []);

    const width = Math[minMaxFunc](...imgData.map((el) => el.width));
    const height = Math[minMaxFunc](...imgData.map((el) => el.height));

    imgData = await Promise.all(imgData.map(async (res) => {
        try {
            res = await new Promise(resolve => {
                if (direction) {
                    res.img.resize(width, ((res.height / res.width) * width), (err, res) => {
                        resolve(res);
                    });
                } else {
                    res.img.resize(((res.width / res.height) * height), height, (err, res) => {
                        resolve(res);
                    });
                }
            });
        } catch (e) {
            console.log(e)
        }
        return {
            img: res,
            width: res.bitmap.width,
            height: res.bitmap.height
        };
    }));

    const {top, right, bottom, left} = calcMargin(margin);
    const marginTopBottom = top + bottom;
    const marginRightLeft = right + left;

    const totalWidth = direction
        ? width
        : imgData.reduce((res, {width}, index) => res + width + (Number(index > 0) * offset), 0);

    const totalHeight = direction
        ? imgData.reduce((res, {height}, index) => res + height + (Number(index > 0) * offset), 0)
        : height;

    const baseImage = new Jimp(totalWidth + marginRightLeft, totalHeight + marginTopBottom, color);

    let offsetX = 0;
    let offsetY = 0;
    for (const {img, height, width} of imgData) {
        const [px, py] = direction
            ? [0, offsetY + offset]
            : [offsetX + offset, 0];
        offsetY += height;
        offsetX += width;
        baseImage.composite(img, px + left, py + top);
    }

    return baseImage;
}
