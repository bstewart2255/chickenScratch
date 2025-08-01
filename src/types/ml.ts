// Machine Learning-specific type definitions

export interface MLModel {
  id: string;
  name: string;
  version: string;
  type: 'random_forest' | 'neural_network' | 'svm' | 'xgboost';
  status: 'training' | 'ready' | 'deployed' | 'archived';
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  createdAt: Date;
  updatedAt: Date;
  hyperparameters: Record<string, any>;
  featureImportance: FeatureImportance[];
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  rank: number;
}

export interface ModelTrainingConfig {
  modelType: 'random_forest' | 'neural_network' | 'svm' | 'xgboost';
  hyperparameters: Record<string, any>;
  crossValidation: CrossValidationConfig;
  featureSelection: FeatureSelectionConfig;
  dataSplit: DataSplitConfig;
}

export interface CrossValidationConfig {
  folds: number;
  shuffle: boolean;
  randomState: number;
}

export interface FeatureSelectionConfig {
  method: 'correlation' | 'mutual_info' | 'recursive' | 'lasso';
  threshold: number;
  maxFeatures: number;
}

export interface DataSplitConfig {
  trainRatio: number;
  validationRatio: number;
  testRatio: number;
  stratify: boolean;
  randomState: number;
}

export interface TrainingMetrics {
  epoch: number;
  trainLoss: number;
  validationLoss: number;
  trainAccuracy: number;
  validationAccuracy: number;
  learningRate: number;
  timestamp: Date;
}

export interface ModelEvaluation {
  modelId: string;
  testAccuracy: number;
  testPrecision: number;
  testRecall: number;
  testF1Score: number;
  confusionMatrix: number[][];
  rocCurve: ROCCurvePoint[];
  precisionRecallCurve: PrecisionRecallPoint[];
  evaluatedAt: Date;
}

export interface ROCCurvePoint {
  falsePositiveRate: number;
  truePositiveRate: number;
  threshold: number;
}

export interface PrecisionRecallPoint {
  precision: number;
  recall: number;
  threshold: number;
}

export interface PredictionResult {
  userId: string;
  signatureId: string;
  prediction: number;
  confidence: number;
  threshold: number;
  isAuthenticated: boolean;
  features: FeatureVector;
  modelVersion: string;
  timestamp: Date;
}

export interface ModelDeployment {
  modelId: string;
  environment: 'development' | 'staging' | 'production';
  version: string;
  deployedAt: Date;
  deployedBy: string;
  healthCheck: HealthCheckResult;
  performance: DeploymentPerformance;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  errorRate: number;
  lastChecked: Date;
  issues: string[];
}

export interface DeploymentPerformance {
  requestsPerSecond: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface FeatureExtractionConfig {
  velocityWindow: number;
  accelerationWindow: number;
  pressureThreshold: number;
  curvatureRadius: number;
  directionBins: number;
  normalizeFeatures: boolean;
}

export interface FeatureExtractionResult {
  features: FeatureVector;
  extractionTime: number;
  quality: number;
  warnings: string[];
} 