import { useEffect, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { ACTIONS } from "../utils/constants";
import {
  readContract,
  writeContract,
  getChains,
  waitForTransactionReceipt
} from "@wagmi/core";
import { formatUnits, parseUnits, erc20Abi, encodeAbiParameters } from 'viem';
import { useChainId, useAccount } from "wagmi";
import { config } from '../wagmi';
import {
  ASSET_ADDRESS,
  ADAPTER_SIDECHAIN_ADDRESS,
  ADAPTER_MAINCHAIN_ADDRESS,
  STG_OFT_ADDRESS,
  ENDPOINT_IDS
} from "../utils/address";
import { AdapterMainchainAbi } from "../utils/abis/AdapterMainchainAbi";
import { AdapterSidechainAbi } from "../utils/abis/AdapterSidechainAbi";
import { CHAIN_IDS } from "../utils/chainid";
import { useChainModal } from '@rainbow-me/rainbowkit';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: ACTIONS;
  asset: string;
  decimals: number;
  balance: bigint;
}

const SupplyRepayModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  action,
  asset,
  decimals,
  balance
}) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const chains = getChains(config);

  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [selectedChain, setSelectedChain] = useState(chains[0].name);
  const [isLoading, setIsLoading] = useState(false);
  const { openChainModal } = useChainModal();
  const [switchNetwork, setSwitchNetwork] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (!value || isNaN(Number(value))) {
      setAmount("");
      setError("Invalid amount");
      return;
    }
    
    const numValue = parseUnits(value.toString(), decimals);
    if (numValue > balance) {
      setError("Insufficient balance");
    } else if (numValue <= 0) {
      setError("Amount must be greater than zero");
    } else {
      setError("");
    }
    setAmount(value);
  };

  const supply = async (amount: bigint, estimateFee: bigint) => {
    try {
      if (asset != "ETH") { // Fetch allowance
        const allowance = await readContract(config, {
          abi: erc20Abi,
          address: ASSET_ADDRESS[asset][chainId],
          functionName: "allowance",
          args: [address!, ADAPTER_SIDECHAIN_ADDRESS[chainId]]
        });

        if (allowance < amount) { // Approve
          const txHash = await writeContract(config, {
            abi: erc20Abi,
            address: ASSET_ADDRESS[asset][chainId],
            functionName: "approve",
            args: [ADAPTER_SIDECHAIN_ADDRESS[chainId], amount]
          });

          await waitForTransactionReceipt(config, {
            hash: txHash
          });
        }
      }

      return await writeContract(config, {
        abi: AdapterSidechainAbi,
        address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
        functionName: "supply",
        args: [
          ASSET_ADDRESS[asset][chainId],
          amount
        ],
        value: estimateFee
      });
    } catch (e) {
      console.error(e);
    }
  }

  const repay = async (amount: bigint, estimateFee: bigint, interestRateMode: number) => {
    try {
      if (asset != "ETH") { // Fetch allowance
        const allowance = await readContract(config, {
          abi: erc20Abi,
          address: ASSET_ADDRESS[asset][chainId],
          functionName: "allowance",
          args: [address!, ADAPTER_SIDECHAIN_ADDRESS[chainId]]
        });

        if (allowance < amount) { // Approve
          const txHash = await writeContract(config, {
            abi: erc20Abi,
            address: ASSET_ADDRESS[asset][chainId],
            functionName: "approve",
            args: [ADAPTER_SIDECHAIN_ADDRESS[chainId], amount]
          });

          await waitForTransactionReceipt(config, {
            hash: txHash
          });
        }
      }

      return await writeContract(config, {
        abi: AdapterSidechainAbi,
        address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
        functionName: "repay",
        args: [
          ASSET_ADDRESS[asset][chainId],
          amount,
          interestRateMode
        ],
        value: estimateFee
      });

    } catch (e) {
      console.error(e);
      return;
    }
  }

  const handleSubmit = async () => {
    if (address && chainId) {
      try {
        setIsLoading(true);

        const amountLD = parseUnits(amount, decimals);
        const functionType = action == ACTIONS.SUPPLY ? 0 : 1;
        const interestRateMode = action == ACTIONS.SUPPLY ? 0 : 2;
        const composedMsg = encodeAbiParameters(
          [
            { type: 'uint8' },
            { type: 'address' },
            { type: 'uint256' }
          ],
          [functionType, address, BigInt(interestRateMode)]
        );
        const estimateFee = await readContract(config, {
          abi: AdapterSidechainAbi,
          address: ADAPTER_SIDECHAIN_ADDRESS[chainId],
          functionName: "estimateFee",
          args: [
            STG_OFT_ADDRESS[asset][chainId],
            ENDPOINT_IDS["747"],
            amountLD,
            ADAPTER_MAINCHAIN_ADDRESS,
            composedMsg
          ]
        })
        
        let txHash;
        if (action == ACTIONS.SUPPLY) {
          txHash = await supply(amountLD, estimateFee as bigint);
        } else { // Repay
          txHash = await repay(amountLD, estimateFee as bigint, 2);
        }

        console.log("txHash: ", txHash);
        if (txHash) { 
          await waitForTransactionReceipt(config, {
            hash: txHash
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }
    
    setAmount("");
    onClose();
  };

  useEffect(() => {
    if (chainId) {
      if (chainId == CHAIN_IDS.FLOW_MAINNET) {
        setSwitchNetwork(true);
      } else {
        setSwitchNetwork(false);
      }
    }
    if (!isOpen) {
      setAmount("");
    }
  }, [isOpen, chainId]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-opacity-50" />
        </Transition.Child>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <Dialog.Panel className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <Dialog.Title className="text-xl font-medium text-gray-900">
                {action}
              </Dialog.Title>

              {!switchNetwork && <div className="mt-4">
                <p className="text-sm text-gray-500">
                  Balance: {Number(formatUnits(balance, decimals)).toFixed(5)}
                </p>
                <input
                  type="number"
                  value={amount}
                  onChange={handleChange}
                  placeholder="Enter amount"
                  className="mt-2 w-full rounded-lg border p-2 text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
              </div>}
              {switchNetwork && openChainModal && (
                <>
                  <p className="my-3">To {action.toLowerCase()} with bridged assets, please switch the network.</p>
                  <button className="rounded-lg p-3 bg-gray-200 text-black hover:bg-gray-400 w-full" onClick={openChainModal} type="button">
                    Switch Network
                  </button>
                </>
              )}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  className={`rounded-lg px-4 py-2 bg-gray-200 text-gray-700 hover:bg-gray-400`}
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  className={`rounded-lg px-4 py-2 text-white ${
                    error || !amount
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                  onClick={handleSubmit}
                  disabled={!!error || !amount}
                >
                  Confirm
                </button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default SupplyRepayModal;
