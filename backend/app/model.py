#import joblib
#import os

#MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model/fake_news_model.pkl')
#model = joblib.load(MODEL_PATH)

#def predict_fake_news(text):
    #prediction = model.predict([text])[0]
    #return bool(prediction)

def predict_fake_news(text):
    # Dummy logic: fake if "clickbait" in text
    return "fake" if "clickbait" in text.lower() else "real"
