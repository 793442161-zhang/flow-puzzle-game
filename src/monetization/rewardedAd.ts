export type RewardedAdPlacement = 'hint' | 'double-reward';

export type RewardedAdStatus = 'completed' | 'skipped' | 'unavailable' | 'failed';

export interface RewardedAdResult {
  status: RewardedAdStatus;
  rewardGranted: boolean;
}

export interface RewardedAdProvider {
  show(placement: RewardedAdPlacement): Promise<RewardedAdResult>;
}

const developmentRewardedAdProvider: RewardedAdProvider = {
  async show() {
    return {
      status: 'completed',
      rewardGranted: true,
    };
  },
};

let rewardedAdProvider = developmentRewardedAdProvider;

export function setRewardedAdProvider(provider: RewardedAdProvider) {
  rewardedAdProvider = provider;
}

export async function showRewardedAd(placement: RewardedAdPlacement) {
  return rewardedAdProvider.show(placement);
}
