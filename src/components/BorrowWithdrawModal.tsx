import { useEffect, useState } from "react";
import { Dialog, Listbox, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { ACTIONS } from "../utils/constants";
import {
  readContract,
  writeContract,
  waitForTransactionReceipt
} from "@wagmi/core";
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { useChainId, useAccount, useSwitchChain } from "wagmi";
import { config } from '../wagmi';
import {
  ASSET_ADDRESS,
  MTOKEN_ADDRESS,
  ADAPTER_MAINCHAIN_ADDRESS,
  DEBT_ADDRESS,
  STG_OFT_ADDRESS,
  ENDPOINT_IDS
} from "../utils/address";
import { DebtAbi } from "../utils/abis/DebtAbi";
import { AdapterMainchainAbi } from "../utils/abis/AdapterMainchainAbi";
import { CHAIN_IDS } from "../utils/chainid";
import { useChainModal } from '@rainbow-me/rainbowkit';
import { InformationCircleIcon } from "@heroicons/react/24/solid";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: ACTIONS;
  asset: string;
  decimals: number;
  balance: bigint;
}

const BorrowWithdrawModal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  action,
  asset,
  decimals,
  balance
}) => {
  const chainId = useChainId();
  const { address } = useAccount();
  const { chains, switchChain } = useSwitchChain();

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

  const borrow = async (amount: bigint, estimateFee: bigint, interestRateMode: number) => {
    try {
      const allowance = await readContract(config, {
        abi: DebtAbi,
        address: DEBT_ADDRESS[asset],
        functionName: "borrowAllowance",
        args: [address!, ADAPTER_MAINCHAIN_ADDRESS]
      }) as bigint;

      if (allowance < amount) { // approve
        const txHash = await writeContract(config, {
          abi: DebtAbi,
          address: DEBT_ADDRESS[asset],
          functionName: "approveDelegation",
          args: [ADAPTER_MAINCHAIN_ADDRESS, amount]
        });

        await waitForTransactionReceipt(config, {
          hash: txHash
        });
      }

      return await writeContract(config, {
        abi: AdapterMainchainAbi,
        address: ADAPTER_MAINCHAIN_ADDRESS,
        functionName: "borrow",
        args: [
          ASSET_ADDRESS[asset][chainId],
          amount,
          interestRateMode,
          ENDPOINT_IDS[CHAIN_IDS.MAINNET],
          address
        ],
        value: estimateFee
      });
    } catch (e) {
      console.error(e);
      return;
    }
  }

  const withdraw = async (amount: bigint, estimateFee: bigint) => {
    try {
      const allowance = await readContract(config, {
        abi: erc20Abi,
        address: MTOKEN_ADDRESS[asset],
        functionName: "allowance",
        args: [address!, ADAPTER_MAINCHAIN_ADDRESS]
      });

      if (allowance < amount) { // approve
        const txHash = await writeContract(config, {
          abi: erc20Abi,
          address: MTOKEN_ADDRESS[asset],
          functionName: "approve",
          args: [ADAPTER_MAINCHAIN_ADDRESS, amount]
        });
    
        await waitForTransactionReceipt(config, {
          hash: txHash
        });
      }

      return await writeContract(config, {
        abi: AdapterMainchainAbi,
        address: ADAPTER_MAINCHAIN_ADDRESS,
        functionName: "withdraw",
        args: [
          ASSET_ADDRESS[asset][chainId],
          MTOKEN_ADDRESS[asset],
          amount,
          ENDPOINT_IDS[CHAIN_IDS.MAINNET],
          address
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
        setIsLoading(true);
        try {
            const amountLD = parseUnits(amount, decimals);

            const estimateFee = await readContract(config, {
                abi: AdapterMainchainAbi,
                address: ADAPTER_MAINCHAIN_ADDRESS,
                functionName: "estimateFee",
                args: [
                    STG_OFT_ADDRESS[asset][chainId],
                    ENDPOINT_IDS[CHAIN_IDS.MAINNET],
                    amountLD,
                    address,
                    "0x"
                ]
            });
            
            let txHash;
            if (action == ACTIONS.BORROW) {
                txHash = await borrow(amountLD, estimateFee as bigint, 2);
            } else { // withdraw
                txHash = await withdraw(amountLD, estimateFee as bigint);
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
      if (chainId != CHAIN_IDS.FLOW_MAINNET) {
        setSwitchNetwork(true);
      } else setSwitchNetwork(false);
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
                  Available: {Number(formatUnits(balance, decimals)).toFixed(5)}
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
              {switchNetwork && (
                <>
                    <p className="my-3">To bridge {action == ACTIONS.BORROW ? "borrowed" : "withdrawn"} assets, please switch the Flow network.</p>
                    <button
                        className="rounded-lg p-3 bg-gray-200 text-black hover:bg-gray-400 w-full"
                        onClick={() => switchChain({ chainId: CHAIN_IDS.FLOW_MAINNET })}
                    >
                        Switch to the Flow network.
                    </button>
                </>
              )}
              {/* Network Selection Dropdown */}
              {!switchNetwork && <div className="mt-3">
                    <Listbox value={selectedChain} onChange={setSelectedChain}>
                        <p className="text-sm text-gray-500 mb-2">
                        Select a Network:
                        </p>
                        <div className="relative">
                        <Listbox.Button className="relative w-full cursor-pointer rounded-lg border bg-white p-2 text-left text-gray-900 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <span className="block truncate">{selectedChain}</span>
                        </Listbox.Button>
                        <Transition
                            as={Fragment}
                            leave="transition ease-in duration-100"
                            leaveFrom="opacity-100"
                            leaveTo="opacity-0"
                        >
                            <Listbox.Options className="absolute mt-1 w-full max-h-60 overflow-auto rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                            {chains.map((network, idx) => (
                                network.id != 747 && <Listbox.Option
                                key={idx}
                                className={({ active }) =>
                                    `relative cursor-pointer select-none p-2 ${
                                    active ? "bg-blue-500 text-white" : "text-gray-900"
                                    }`
                                }
                                value={network.name}
                                >
                                {({ selected }) => (
                                    <>
                                    <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                        {network.name}
                                    </span>
                                    </>
                                )}
                                </Listbox.Option>
                            ))}
                            </Listbox.Options>
                        </Transition>
                        </div>
                    </Listbox>
                    <div className="flex mx-1 my-3">
                        <InformationCircleIcon className="w-10 h-10 text-gray-500 mr-2" />
                        <span className="text-md text-gray-700">
                            Please enter the available amount and select a target network to bridge {action == ACTIONS.BORROW ? "borrowed" : "withdrawn"} assets.
                        </span>
                    </div>
              </div>
              
              }
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

export default BorrowWithdrawModal;
