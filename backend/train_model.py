import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import pickle
import os

# Create models directory
os.makedirs('models', exist_ok=True)

print("Generating synthetic telemetry data...")
np.random.seed(42)
n_samples = 10000

# Features:
# 1. merchant_latency_avg_5m (ms) - Average response time of the merchant server over the last 5 minutes
# 2. merchant_error_rate_5m (%) - Error rate of the merchant server over the last 5 minutes
# 3. payload_size_kb - Size of the webhook payload
# 4. hour_of_day (0-23)
# 5. day_of_week (0-6)

data = {
    'merchant_latency_avg_5m': np.random.normal(loc=200, scale=100, size=n_samples).clip(min=50),
    'merchant_error_rate_5m': np.random.uniform(0, 0.05, size=n_samples), # Usually low error rate
    'payload_size_kb': np.random.lognormal(mean=2, sigma=1, size=n_samples).clip(min=1, max=1000),
    'hour_of_day': np.random.randint(0, 24, size=n_samples),
    'day_of_week': np.random.randint(0, 7, size=n_samples)
}

df = pd.DataFrame(data)

# Inject simulated network degradation scenarios
# Scenario 1: High latency almost always leads to failure/timeouts
# Scenario 2: High recent error rate strongly predicts failure
# Scenario 3: Large payloads fail more often if latency is already somewhat high

# Calculate probability of failure
prob_failure = np.zeros(n_samples)
# Base probability
prob_failure += 0.01 

# High latency impact
prob_failure += np.where(df['merchant_latency_avg_5m'] > 800, 0.6, 0)
prob_failure += np.where((df['merchant_latency_avg_5m'] > 400) & (df['merchant_latency_avg_5m'] <= 800), 0.2, 0)

# Error rate impact
prob_failure += np.where(df['merchant_error_rate_5m'] > 0.15, 0.7, 0)

# Large payload during moderate latency
prob_failure += np.where((df['payload_size_kb'] > 500) & (df['merchant_latency_avg_5m'] > 300), 0.4, 0)

# Peak hour impact (e.g. midnight backups or high traffic at 6 PM)
prob_failure += np.where((df['hour_of_day'] == 18) | (df['hour_of_day'] == 0), 0.1, 0)

# Cap at 0.95
prob_failure = np.clip(prob_failure, 0.01, 0.95)

# Generate target
df['will_fail'] = np.random.binomial(1, prob_failure)

print(f"Dataset generated. Failure rate: {df['will_fail'].mean()*100:.2f}%")

X = df.drop(columns=['will_fail'])
y = df['will_fail']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

print("Training RandomForestClassifier...")
model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight='balanced')
model.fit(X_train, y_train)

y_pred = model.predict(X_test)
print("\nClassification Report:")
print(classification_report(y_test, y_pred))

model_path = 'models/predictor.pkl'
with open(model_path, 'wb') as f:
    pickle.dump(model, f)
    
print(f"Model saved to {model_path}")
