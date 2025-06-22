const imageUpload = document.getElementById('imageUpload');
const cameraButton = document.getElementById('camera-button');
const cameraCapture = document.getElementById('cameraCapture');
const previewImage = document.getElementById('preview-image');
const identifyButton = document.getElementById('identify-button');
const processedCanvas = document.getElementById('processedCanvas');
const loadingSpinner = document.getElementById('loading-spinner');
const context = processedCanvas.getContext('2d');
const resultBox = document.getElementById('result-box');

const MODEL_URL = '/models';
const TARGET_IMAGE_SIZE = 224;
const MIN_FACE_DIMENSION = 50;
const PIXEL_EXPANSION_ALL_SIDES = 10;
const PADDING_COLOR = [0, 0, 0];

const hairstyleLinks = {
    'Heart': {
        female: 'https://www.newbeauty.com/haircuts-for-heart-shaped-faces/',
        male: 'https://therighthairstyles.com/hairstyles-for-heart-shaped-face-male/'
    },
    'Oblong': {
        female: 'https://www.byrdie.com/the-most-flattering-hairstyles-for-the-oblong-face-shape-345773',
        male: 'https://therighthairstyles.com/haircuts-for-oblong-faces-men/'
    },
    'Oval': {
        female: 'https://therighthairstyles.com/hairstyles-for-oval-face/',
        male: 'https://menhairstylist.com/mens-hairstyles-for-oval-faces/'
    },
    'Round': {
        female: 'https://www.byrdie.com/hairstyles-for-round-faces-the-most-flattering-cuts-346413',
        male: 'https://therighthairstyles.com/haircuts-for-round-faces-men/'
    },
    'Square': {
        female: 'https://www.byrdie.com/the-best-haircuts-for-square-face-shapes-345768',
        male: 'https://therighthairstyles.com/men-square-face-haircuts/'
    }
};



let modelsLoaded = false;
let imageConfirmed = false;

async function loadModels() {
    try {
        console.log('Attempting to load MTCNN models from:', MODEL_URL);
        identifyButton.textContent = 'Loading models... Please wait.';
        identifyButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        identifyButton.classList.add('bg-gray-500', 'cursor-wait');

        await faceapi.nets.mtcnn.loadFromUri(MODEL_URL);
        console.log('MTCNN models loaded successfully!');

        identifyButton.textContent = 'Identify facial shape';
        modelsLoaded = true;
        checkImageStatus();
    } catch (error) {
        console.error('Error loading MTCNN models:', error);
        alert('Failed to load face detection models.');
        identifyButton.textContent = 'Error loading models';
        identifyButton.disabled = true;
        identifyButton.classList.add('bg-red-500', 'cursor-not-allowed');
    }
}

document.addEventListener('DOMContentLoaded', loadModels);

function checkImageStatus() {
    if (imageConfirmed && modelsLoaded) {
        identifyButton.disabled = false;
        identifyButton.classList.remove('bg-gray-400', 'cursor-not-allowed', 'bg-gray-500', 'cursor-wait');
        identifyButton.classList.add('bg-blue-600', 'hover:bg-blue-700', 'cursor-pointer');
    } else {
        identifyButton.disabled = true;
        identifyButton.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'cursor-pointer');
        identifyButton.classList.add(modelsLoaded ? 'bg-gray-400' : 'bg-gray-500');
    }
}

function handleImageFile(file) {
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            previewImage.src = e.target.result;
            previewImage.onload = () => {
                previewImage.classList.remove('hidden');
                processedCanvas.classList.add('hidden');
                imageConfirmed = true;
                checkImageStatus();
            };
            previewImage.onerror = () => {
                alert("Failed to load image.");
                previewImage.src = '#';
                imageConfirmed = false;
                checkImageStatus();
            };
        };
        reader.readAsDataURL(file);
    } else {
        previewImage.src = '#';
        previewImage.classList.add('hidden');
        processedCanvas.classList.add('hidden');
        imageConfirmed = false;
        checkImageStatus();
    }
}

imageUpload.addEventListener('change', e => handleImageFile(e.target.files[0]));
cameraButton.addEventListener('click', () => cameraCapture.click());
cameraCapture.addEventListener('change', e => handleImageFile(e.target.files[0]));

identifyButton.addEventListener('click', async () => {
    if (!modelsLoaded || !imageConfirmed) {
        alert("Model not loaded or image not selected.");
        return;
    }

    loadingSpinner.classList.remove('hidden');
    previewImage.classList.add('hidden');
    processedCanvas.classList.remove('hidden');
    resultBox.classList.add('hidden');

    try {
        const detections = await faceapi.detectAllFaces(previewImage, new faceapi.MtcnnOptions());

        if (detections.length === 0) {
            alert("No face detected.");
            previewImage.classList.remove('hidden');
            processedCanvas.classList.add('hidden');
            return;
        }

        let bestFace = null, maxArea = 0;
        for (const det of detections) {
            const area = det.box.width * det.box.height;
            if (area > maxArea && det.box.width >= MIN_FACE_DIMENSION && det.box.height >= MIN_FACE_DIMENSION) {
                maxArea = area;
                bestFace = det.box;
            }
        }

        if (!bestFace) {
            alert("No face with sufficient size.");
            previewImage.classList.remove('hidden');
            processedCanvas.classList.add('hidden');
            return;
        }

        const imgWidth = previewImage.naturalWidth;
        const imgHeight = previewImage.naturalHeight;

        let x1 = Math.max(0, bestFace.x - PIXEL_EXPANSION_ALL_SIDES);
        let y1 = Math.max(0, bestFace.y - PIXEL_EXPANSION_ALL_SIDES);
        let x2 = Math.min(imgWidth, bestFace.x + bestFace.width + PIXEL_EXPANSION_ALL_SIDES);
        let y2 = Math.min(imgHeight, bestFace.y + bestFace.height + PIXEL_EXPANSION_ALL_SIDES);

        const cropWidth = x2 - x1;
        const cropHeight = y2 - y1;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cropWidth;
        tempCanvas.height = cropHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(previewImage, x1, y1, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        const maxSide = Math.max(cropWidth, cropHeight);
        const padTop = Math.floor((maxSide - cropHeight) / 2);
        const padLeft = Math.floor((maxSide - cropWidth) / 2);

        processedCanvas.width = maxSide;
        processedCanvas.height = maxSide;
        context.fillStyle = `rgb(${PADDING_COLOR[0]}, ${PADDING_COLOR[1]}, ${PADDING_COLOR[2]})`;
        context.fillRect(0, 0, maxSide, maxSide);
        context.drawImage(tempCanvas, padLeft, padTop);

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = TARGET_IMAGE_SIZE;
        finalCanvas.height = TARGET_IMAGE_SIZE;
        finalCanvas.getContext('2d').drawImage(processedCanvas, 0, 0, TARGET_IMAGE_SIZE, TARGET_IMAGE_SIZE);

        context.clearRect(0, 0, processedCanvas.width, processedCanvas.height);
        processedCanvas.width = TARGET_IMAGE_SIZE;
        processedCanvas.height = TARGET_IMAGE_SIZE;
        context.drawImage(finalCanvas, 0, 0);

        // === Send to Backend ===
        const base64Image = processedCanvas.toDataURL("image/jpeg");

        const response = await fetch('http://localhost:8888/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64Image })
        });

        const result = await response.json();
		const resultBox = document.getElementById('result-box');
		const links = hairstyleLinks[result.facial_shape];

        if (result.error) {
            resultBox.textContent = "Error: " + result.error;
        } else {
            resultBox.innerHTML = `
                <p><strong>Facial Shape:</strong> ${result.facial_shape}</p>
				<p><strong>Confidence:</strong> ${result.confidence}</p>
                <p><strong>Female Recommendation:</strong> ${result.female_recommendation}</p>
				  <p><a href="${links.female}" target="_blank" class="text-pink-600 hover:underline">
					  ➤ Female hairstyle ideas
				  </a></p>
				  <div class="flex flex-wrap justify-center gap-2 my-2">
						${result.female_images.map(url => `
							<img src="${url}" class="w-24 h-24 rounded-lg border object-cover" alt="Female hairstyle">
						`).join('')}
					</div>
				  <p><strong>Male Recommendation:</strong> ${result.male_recommendation}</p>
				  <p><a href="${links.male}" target="_blank" class="text-blue-600 hover:underline">
					  ➤ Male hairstyle ideas
				  </a></p>
				  <div class="flex flex-wrap justify-center gap-2 my-2">
						${result.male_images.map(url => `
							<img src="${url}" class="w-24 h-24 rounded-lg border object-cover" alt="Male hairstyle">
						`).join('')}
					</div>
            `;
        }
        resultBox.classList.remove('hidden');

    } catch (err) {
        console.error(err);
        alert("An error occurred during processing.");
        resultBox.textContent = "Error: " + err.message;
        resultBox.classList.remove('hidden');
    } finally {
        loadingSpinner.classList.add('hidden');
    }
});
