from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import base64
import io
from PIL import Image
import numpy as np
from tensorflow.keras.models import load_model
import os

# Load CNN model
model = load_model('facial_shape_classifier.keras')

# Class labels
class_names = ['Heart', 'Oblong', 'Oval', 'Round', 'Square']

app = Flask(__name__, static_url_path='/static', template_folder='templates')
CORS(app)  # Allow frontend access

# Hairstyle recommendations
recommendations = {
    'round': {
        'female': "Crinkled lob, old hollywood wave, etc",
        'male': "Curly hair sut, taper cut, etc"
    },
    'oval': {
        'female': "Wispy long bob, wavy medium length, etc",
        'male': "The crop, flow back, etc"
    },
    'square': {
        'female': "Curtain bangs, curly and short, etc",
        'male': "Fullshave, buzzcut, etc"
    },
    'heart': {
        'female': "Long layered, semi-side swept bang, etc",
        'male': "Temple fade with high top, middle part, etc"
    },
    'oblong': {
        'female': "Curly shag, center-parted ponytail, etc",
        'male': "Tapered mullet, low comb fade over, etc"
    }
}

def get_sample_images(gender, facial_shape):
    folder = f'static/hairstyles/{gender}'
    shape = facial_shape.lower()
    images = []

    if os.path.exists(folder):
        for file in os.listdir(folder):
            if file.lower().startswith(shape) and file.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                images.append(f'/static/hairstyles/{gender}/{file}')
    return images[:5] 

def preprocess_image(image_bytes):
    image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
    image = image.resize((128, 128))
    image_array = np.array(image) / 255.0
    return np.expand_dims(image_array, axis=0)

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json()

    if 'image' not in data:
        return jsonify({'error': 'No image data'}), 400

    try:
        # Decode base64
        image_data = data['image'].split(',')[-1]
        image_bytes = base64.b64decode(image_data)

        processed_image = preprocess_image(image_bytes)
        prediction = model.predict(processed_image)
        print("Raw prediction:", prediction)
        predicted_index = np.argmax(prediction)
        predicted_label = class_names[predicted_index]
        print("Predicted index:", predicted_index)
        print("Predicted label:", predicted_label)
        
        confidence = float(np.max(prediction)) * 100
        print("Predicted label:", predicted_label)
        print("Confidence:", confidence)
        
        key = predicted_label.lower()  # Match recommendation keys

        # Get recommendations
        female = recommendations[key]['female']
        male = recommendations[key]['male']
        
        print("Key used for recommendations:", key)
        print("Recommendation (female):", recommendations[key]['female'])
        
        female_images = get_sample_images('female', predicted_label)
        male_images = get_sample_images('male', predicted_label)

        return jsonify({
            'facial_shape': predicted_label,
            'confidence': f"{confidence:.2f}%",
            'female_recommendation': female,
            'male_recommendation': male,
            'female_images': female_images,
            'male_images': male_images
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)

