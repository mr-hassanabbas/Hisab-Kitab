// Risk-Based Confirmation for Version 1
// Dynamically determines confirmation requirements based on context and risk factors

export interface RiskFactors {
  userRole: string;
  operationType: string;
  amount?: number;
  timeOfDay: Date;
  location?: string;
  historicalPattern: number; // 0-1, how common this operation is
  contextConfidence: number; // 0-1, confidence in context understanding
}

export interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number; // 0-100
  requiresConfirmation: boolean;
  confirmationType: 'none' | 'simple' | 'detailed' | 'two_factor';
  reasons: string[];
  suggestedActions: string[];
}

export interface ConfirmationRequirement {
  requiresConfirmation: boolean;
  confirmationType: 'none' | 'simple' | 'detailed' | 'two_factor';
  confirmationMessage: string;
  confirmButtonText: string;
  cancelButtonText: string;
  additionalChecks?: string[];
}

export class RiskBasedConfirmation {
  private roleRiskMultipliers: Record<string, number> = {
    owner: 0.5,
    admin: 0.7,
    manager: 1.0,
    accountant: 1.2,
    worker: 1.5,
    viewer: 2.0
  };

  private operationRiskScores: Record<string, number> = {
    // Low risk operations
    'get_attendance': 5,
    'get_worker_info': 5,
    'query_payments': 5,
    'query_projects': 5,
    'attendance_report': 5,
    
    // Medium risk operations
    'mark_attendance': 20,
    'create_worker': 30,
    'add_expense': 35,
    'add_material': 30,
    'create_payment': 40,
    
    // High risk operations
    'update_attendance': 50,
    'update_payment': 55,
    'delete_attendance': 70,
    'delete_payment': 75,
    'delete_project': 80,
    'delete_worker': 75,
    'delete_material': 70
  };

  /**
   * Assess risk for an operation
   */
  assessRisk(factors: RiskFactors): RiskAssessment {
    let riskScore = 0;
    const reasons: string[] = [];
    const suggestedActions: string[] = [];

    // Base risk from operation type
    const operationRisk = this.operationRiskScores[factors.operationType] || 30;
    riskScore += operationRisk;

    // Role multiplier
    const roleMultiplier = this.roleRiskMultipliers[factors.userRole] || 1.0;
    riskScore *= roleMultiplier;

    if (roleMultiplier > 1.0) {
      reasons.push(`User role (${factors.userRole}) has elevated risk`);
    }

    // Amount-based risk
    if (factors.amount !== undefined) {
      if (factors.amount > 100000) {
        riskScore += 30;
        reasons.push('High amount involved (>100,000)');
        suggestedActions.push('Verify amount with financial records');
      } else if (factors.amount > 10000) {
        riskScore += 15;
        reasons.push('Significant amount involved (>10,000)');
      } else if (factors.amount > 1000) {
        riskScore += 5;
      }
    }

    // Time-based risk (unusual hours)
    const hour = factors.timeOfDay.getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 15;
      reasons.push('Operation at unusual time');
      suggestedActions.push('Verify user identity');
    }

    // Context confidence
    if (factors.contextConfidence < 0.5) {
      riskScore += 20;
      reasons.push('Low confidence in context understanding');
      suggestedActions.push('Request additional clarification');
    } else if (factors.contextConfidence < 0.7) {
      riskScore += 10;
      reasons.push('Moderate confidence in context');
    }

    // Historical pattern (low frequency = higher risk)
    if (factors.historicalPattern < 0.1) {
      riskScore += 15;
      reasons.push('Unusual operation for this user');
      suggestedActions.push('Verify user intent');
    } else if (factors.historicalPattern < 0.3) {
      riskScore += 5;
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical';
    if (riskScore < 30) {
      riskLevel = 'low';
    } else if (riskScore < 50) {
      riskLevel = 'medium';
    } else if (riskScore < 75) {
      riskLevel = 'high';
    } else {
      riskLevel = 'critical';
    }

    // Determine confirmation requirements
    let requiresConfirmation = true;
    let confirmationType: 'none' | 'simple' | 'detailed' | 'two_factor' = 'simple';

    if (riskLevel === 'low' && factors.userRole === 'owner') {
      requiresConfirmation = false;
      confirmationType = 'none';
    } else if (riskLevel === 'low') {
      confirmationType = 'simple';
    } else if (riskLevel === 'medium') {
      confirmationType = 'simple';
    } else if (riskLevel === 'high') {
      confirmationType = 'detailed';
    } else if (riskLevel === 'critical') {
      confirmationType = 'two_factor';
    }

    return {
      riskLevel,
      riskScore: Math.min(100, Math.round(riskScore)),
      requiresConfirmation,
      confirmationType,
      reasons,
      suggestedActions
    };
  }

  /**
   * Generate confirmation requirement
   */
  generateConfirmation(
    assessment: RiskAssessment,
    operationDetails: string,
    language: 'urdu' | 'english' = 'urdu'
  ): ConfirmationRequirement {
    const messages = {
      urdu: {
        simple: {
          message: `کیا آپ واقعی یہ کرنا چاہتے ہیں؟ ${operationDetails}`,
          confirm: 'جی ہاں',
          cancel: 'نہیں'
        },
        detailed: {
          message: `یہ عمل خطرناک ہے۔ تفصیلات: ${operationDetails}\nخطرے: ${assessment.reasons.join(', ')}`,
          confirm: 'مجھتا کرنا چاہتا ہوں',
          cancel: 'منسوخ کریں'
        },
        two_factor: {
          message: `یہ عمل انتہائی خطرناک ہے۔ دو طرفی توثیق کی ضرورت ہے۔\nتفصیلات: ${operationDetails}`,
          confirm: 'توثیق کریں',
          cancel: 'منسوخ کریں'
        }
      },
      english: {
        simple: {
          message: `Are you sure you want to do this? ${operationDetails}`,
          confirm: 'Yes',
          cancel: 'No'
        },
        detailed: {
          message: `This operation is risky. Details: ${operationDetails}\nRisks: ${assessment.reasons.join(', ')}`,
          confirm: 'I understand, proceed',
          cancel: 'Cancel'
        },
        two_factor: {
          message: `This operation is extremely risky. Two-factor authentication required.\nDetails: ${operationDetails}`,
          confirm: 'Authenticate',
          cancel: 'Cancel'
        }
      }
    };

    const langMessages = messages[language];
    const typeMessages = langMessages[assessment.confirmationType] || langMessages.simple;

    const requirement: ConfirmationRequirement = {
      requiresConfirmation: assessment.requiresConfirmation,
      confirmationType: assessment.confirmationType,
      confirmationMessage: typeMessages.message,
      confirmButtonText: typeMessages.confirm,
      cancelButtonText: typeMessages.cancel
    };

    // Add additional checks for detailed/two-factor
    if (assessment.confirmationType === 'detailed' || assessment.confirmationType === 'two_factor') {
      requirement.additionalChecks = assessment.suggestedActions;
    }

    return requirement;
  }

  /**
   * Update role risk multiplier
   */
  updateRoleRiskMultiplier(role: string, multiplier: number): void {
    this.roleRiskMultipliers[role] = multiplier;
  }

  /**
   * Update operation risk score
   */
  updateOperationRiskScore(operation: string, score: number): void {
    this.operationRiskScores[operation] = score;
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      roleRiskMultipliers: { ...this.roleRiskMultipliers },
      operationRiskScores: { ...this.operationRiskScores }
    };
  }
}

// Singleton instance
export const riskBasedConfirmation = new RiskBasedConfirmation();
