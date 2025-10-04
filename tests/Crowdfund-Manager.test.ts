import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_GOAL = 101;
const ERR_INVALID_DEADLINE = 102;
const ERR_INVALID_NFT_ID = 103;
const ERR_CAMPAIGN_EXISTS = 104;
const ERR_CAMPAIGN_NOT_FOUND = 105;
const ERR_INVALID_CONTRIB = 106;
const ERR_DEADLINE_PASSED = 107;
const ERR_GOAL_NOT_MET = 108;
const ERR_GOAL_MET = 109;
const ERR_INVALID_STATUS = 110;
const ERR_REFUND_FAILED = 111;
const ERR_TRANSFER_FAILED = 112;
const ERR_INVALID_DESCRIPTION = 113;
const ERR_INVALID_TITLE = 114;
const ERR_MAX_CAMPAIGNS_EXCEEDED = 115;
const ERR_INVALID_MIN_CONTRIB = 116;
const ERR_INVALID_MAX_CONTRIB = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_MILESTONES = 119;

interface Campaign {
  nftId: number;
  title: string;
  description: string;
  goal: number;
  raised: number;
  deadline: number;
  creator: string;
  status: number;
  location: string;
  minContrib: number;
  maxContrib: number;
  milestones: number;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class CrowdfundManagerMock {
  state: {
    nextCampaignId: number;
    maxCampaigns: number;
    creationFee: number;
    escrowContract: string;
    oracleContract: string;
    campaigns: Map<number, Campaign>;
    contributions: Map<string, number>;
    campaignsByNft: Map<number, number>;
  } = {
    nextCampaignId: 0,
    maxCampaigns: 500,
    creationFee: 500,
    escrowContract: "SP000000000000000000002Q6VF78",
    oracleContract: "SP000000000000000000002Q6VF78",
    campaigns: new Map(),
    contributions: new Map(),
    campaignsByNft: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextCampaignId: 0,
      maxCampaigns: 500,
      creationFee: 500,
      escrowContract: "SP000000000000000000002Q6VF78",
      oracleContract: "SP000000000000000000002Q6VF78",
      campaigns: new Map(),
      contributions: new Map(),
      campaignsByNft: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  setEscrowContract(newEscrow: string): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    this.state.escrowContract = newEscrow;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (this.caller !== "ST1TEST") return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_TITLE };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  startCampaign(
    nftId: number,
    title: string,
    description: string,
    goal: number,
    deadline: number,
    location: string,
    minContrib: number,
    maxContrib: number,
    milestones: number
  ): Result<number> {
    if (this.state.nextCampaignId >= this.state.maxCampaigns) return { ok: false, value: ERR_MAX_CAMPAIGNS_EXCEEDED };
    if (nftId <= 0) return { ok: false, value: ERR_INVALID_NFT_ID };
    if (!title || title.length > 100) return { ok: false, value: ERR_INVALID_TITLE };
    if (!description || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (goal <= 0) return { ok: false, value: ERR_INVALID_GOAL };
    if (deadline <= this.blockHeight) return { ok: false, value: ERR_INVALID_DEADLINE };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (minContrib <= 0) return { ok: false, value: ERR_INVALID_MIN_CONTRIB };
    if (maxContrib <= 0) return { ok: false, value: ERR_INVALID_MAX_CONTRIB };
    if (milestones <= 0 || milestones > 10) return { ok: false, value: ERR_INVALID_MILESTONES };
    if (this.state.campaignsByNft.has(nftId)) return { ok: false, value: ERR_CAMPAIGN_EXISTS };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: "ST1TEST" });

    const id = this.state.nextCampaignId;
    const campaign: Campaign = {
      nftId,
      title,
      description,
      goal,
      raised: 0,
      deadline,
      creator: this.caller,
      status: 0,
      location,
      minContrib,
      maxContrib,
      milestones,
    };
    this.state.campaigns.set(id, campaign);
    this.state.campaignsByNft.set(nftId, id);
    this.state.nextCampaignId++;
    return { ok: true, value: id };
  }

  getCampaign(id: number): Campaign | undefined {
    return this.state.campaigns.get(id);
  }

  contribute(campaignId: number, amount: number): Result<number> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) return { ok: false, value: ERR_CAMPAIGN_NOT_FOUND };
    if (this.blockHeight >= campaign.deadline) return { ok: false, value: ERR_DEADLINE_PASSED };
    if (campaign.status !== 0) return { ok: false, value: ERR_INVALID_STATUS };
    if (amount < campaign.minContrib || amount > campaign.maxContrib) return { ok: false, value: ERR_INVALID_CONTRIB };

    this.stxTransfers.push({ amount, from: this.caller, to: "ST1TEST" });

    campaign.raised += amount;
    const key = `${campaignId}-${this.caller}`;
    const currentContrib = this.state.contributions.get(key) || 0;
    this.state.contributions.set(key, currentContrib + amount);
    return { ok: true, value: amount };
  }

  finalizeCampaign(campaignId: number): Result<boolean> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) return { ok: false, value: ERR_CAMPAIGN_NOT_FOUND };
    if (this.blockHeight < campaign.deadline) return { ok: false, value: ERR_DEADLINE_PASSED };
    if (campaign.status !== 0) return { ok: false, value: ERR_INVALID_STATUS };
    if (this.caller !== campaign.creator) return { ok: false, value: ERR_NOT_AUTHORIZED };

    if (campaign.raised >= campaign.goal) {
      this.stxTransfers.push({ amount: campaign.raised, from: "ST1TEST", to: this.state.escrowContract });
      campaign.status = 1;
      return { ok: true, value: true };
    } else {
      campaign.status = 2;
      return { ok: true, value: false };
    }
  }

  refund(campaignId: number): Result<number> {
    const campaign = this.state.campaigns.get(campaignId);
    if (!campaign) return { ok: false, value: ERR_CAMPAIGN_NOT_FOUND };
    if (campaign.status !== 2) return { ok: false, value: ERR_INVALID_STATUS };
    const key = `${campaignId}-${this.caller}`;
    const contrib = this.state.contributions.get(key);
    if (!contrib || contrib <= 0) return { ok: false, value: ERR_INVALID_CONTRIB };

    this.stxTransfers.push({ amount: contrib, from: "ST1TEST", to: this.caller });
    this.state.contributions.delete(key);
    return { ok: true, value: contrib };
  }

  getCampaignCount(): Result<number> {
    return { ok: true, value: this.state.nextCampaignId };
  }

  checkCampaignExistence(nftId: number): Result<boolean> {
    return { ok: true, value: this.state.campaignsByNft.has(nftId) };
  }
}

describe("CrowdfundManager", () => {
  let contract: CrowdfundManagerMock;

  beforeEach(() => {
    contract = new CrowdfundManagerMock();
    contract.reset();
  });

  it("starts a campaign successfully", () => {
    const result = contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const campaign = contract.getCampaign(0);
    expect(campaign?.nftId).toBe(1);
    expect(campaign?.title).toBe("Test Title");
    expect(campaign?.description).toBe("Test Description");
    expect(campaign?.goal).toBe(1000);
    expect(campaign?.raised).toBe(0);
    expect(campaign?.deadline).toBe(100);
    expect(campaign?.creator).toBe("ST1TEST");
    expect(campaign?.status).toBe(0);
    expect(campaign?.location).toBe("Test Location");
    expect(campaign?.minContrib).toBe(10);
    expect(campaign?.maxContrib).toBe(500);
    expect(campaign?.milestones).toBe(5);
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST1TEST" }]);
  });

  it("rejects duplicate campaign for same NFT", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    const result = contract.startCampaign(
      1,
      "Another Title",
      "Another Description",
      2000,
      200,
      "Another Location",
      20,
      1000,
      3
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_CAMPAIGN_EXISTS);
  });

  it("rejects invalid NFT ID", () => {
    const result = contract.startCampaign(
      0,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_NFT_ID);
  });

  it("rejects invalid title", () => {
    const result = contract.startCampaign(
      1,
      "",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_TITLE);
  });

  it("contributes successfully", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    const result = contract.contribute(0, 100);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(100);
    const campaign = contract.getCampaign(0);
    expect(campaign?.raised).toBe(100);
    const contrib = contract.state.contributions.get("0-ST1TEST");
    expect(contrib).toBe(100);
  });

  it("rejects contribution after deadline", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    contract.blockHeight = 100;
    const result = contract.contribute(0, 100);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DEADLINE_PASSED);
  });

  it("finalizes failed campaign", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    contract.contribute(0, 500);
    contract.blockHeight = 100;
    const result = contract.finalizeCampaign(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(false);
    const campaign = contract.getCampaign(0);
    expect(campaign?.status).toBe(2);
  });

  it("refunds contributor", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    contract.contribute(0, 500);
    contract.blockHeight = 100;
    contract.finalizeCampaign(0);
    const result = contract.refund(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(500);
    const contrib = contract.state.contributions.get("0-ST1TEST");
    expect(contrib).toBeUndefined();
    expect(contract.stxTransfers[contract.stxTransfers.length - 1]).toEqual({ amount: 500, from: "ST1TEST", to: "ST1TEST" });
  });

  it("sets creation fee successfully", () => {
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.creationFee).toBe(1000);
  });

  it("rejects unauthorized set creation fee", () => {
    contract.caller = "ST2FAKE";
    const result = contract.setCreationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("gets campaign count", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    contract.startCampaign(
      2,
      "Another Title",
      "Another Description",
      2000,
      200,
      "Another Location",
      20,
      1000,
      3
    );
    const result = contract.getCampaignCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks campaign existence", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    const result = contract.checkCampaignExistence(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkCampaignExistence(999);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses campaign parameters with Clarity types", () => {
    const title = stringUtf8CV("Test Title");
    const goal = uintCV(1000);
    expect(title.value).toBe("Test Title");
    expect(goal.value).toEqual(BigInt(1000));
  });

  it("rejects campaign start with max exceeded", () => {
    contract.state.maxCampaigns = 1;
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    const result = contract.startCampaign(
      2,
      "Another Title",
      "Another Description",
      2000,
      200,
      "Another Location",
      20,
      1000,
      3
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_CAMPAIGNS_EXCEEDED);
  });

  it("rejects finalize before deadline", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    const result = contract.finalizeCampaign(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DEADLINE_PASSED);
  });

  it("rejects finalize by non-creator", () => {
    contract.startCampaign(
      1,
      "Test Title",
      "Test Description",
      1000,
      100,
      "Test Location",
      10,
      500,
      5
    );
    contract.blockHeight = 100;
    contract.caller = "ST2FAKE";
    const result = contract.finalizeCampaign(0);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});