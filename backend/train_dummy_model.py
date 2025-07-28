# 📁 backend/app/train_dummy_model.py
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
import joblib
import os

# Dummy dataset
X = [
    "Breaking: You won't believe what happened next!",
    "This is a clickbait title for fake news",
    "The president signed a new law today",
    "Study shows COVID-19 vaccine is effective",
    "Aliens land in New York City!",
    "Doctors reveal new miracle cure",
    "Central bank announces new interest rate policy",
    "Click here to win an iPhone for free!",
]

y = [
    "fake",
    "fake",
    "real",
    "real",
    "fake",
    "fake",
    "real",
    "fake",
]

# Create pipeline
model = Pipeline([
    ("tfidf", TfidfVectorizer()),
    ("clf", MultinomialNB()),
])

# Train model
model.fit(X, y)

# Save model to app/model/fake_news_model.pkl
model_dir = os.path.join(os.path.dirname(__file__), "model")
os.makedirs(model_dir, exist_ok=True)
model_path = os.path.join(model_dir, "fake_news_model.pkl")

joblib.dump(model, model_path)
print(f"✅ Dummy model saved at {model_path}")
