/**
 * Public creator / donate links for InstantDrama Magician.
 * Keep in sync with README.md / README-ZH.md § Creator.
 */

export const CREATOR_HANDLE = 'Ki (yanshekki)'
export const CREATOR_LINKTREE = 'https://linktr.ee/yanshekki'
export const YSK_HOME_URL = 'https://ysk.hk/'
export const CREATOR_EMAIL = 'email@ysk.hk'

export type DonateNetworkId = 'evm' | 'near' | 'ada'

export const DONATE_ADDRESSES: ReadonlyArray<{
  id: DonateNetworkId
  /** Display label (English); UI may i18n via settings.creator.network.* */
  networkLabel: string
  address: string
}> = [
  {
    id: 'evm',
    networkLabel: 'EVM (ETH/BSC/AVAX)',
    address: 'yanshekki.eth'
  },
  {
    id: 'near',
    networkLabel: 'NEAR',
    address: 'yanshekki.near'
  },
  {
    id: 'ada',
    networkLabel: 'ADA (Cardano)',
    address: '$yanshekki'
  }
]
