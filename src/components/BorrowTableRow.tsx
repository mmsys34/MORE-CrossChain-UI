import { useEffect, useState } from "react";
import { Button } from "@headlessui/react";
import { ACTIONS } from "../utils/constants";
import { useChainId, useAccount } from "wagmi";
import { formatUnits, erc20Abi } from 'viem';
import { readContracts, getBalance } from '@wagmi/core';
import { config } from '../wagmi';
import { ASSET_ADDRESS } from "../utils/address";

const BorrowTableRow = ({ asset, openModal } : { asset: string, openModal: (selectedAsset: string, decimals: number, balance: bigint, action: ACTIONS) => void}) => {
    const chainId = useChainId();
    const { address, isConnected } = useAccount();
    const [ balance, setBalance ] = useState<bigint>(BigInt(0));
    const [ decimals, setDecimals ] = useState<number>(18);
    
    useEffect(() => {
        (async() => {
            if (address && chainId) {
                if (asset != "ETH") {
                    const result = await readContracts(config, {
                        allowFailure: false,
                        contracts: [ 
                            { 
                                address: ASSET_ADDRESS[asset][chainId],
                                abi: erc20Abi, 
                                functionName: 'balanceOf', 
                                args: [address], 
                            }, 
                            { 
                                address: ASSET_ADDRESS[asset][chainId],
                                abi: erc20Abi, 
                                functionName: 'decimals', 
                            }, 
                            { 
                                address: ASSET_ADDRESS[asset][chainId],
                                abi: erc20Abi, 
                                functionName: 'symbol', 
                            }, 
                        ]
                    });
                    setBalance(result[0]);
                    setDecimals(result[1]);
                } else {
                    const result = await getBalance(config, {
                        address: address,
                    });
                    setBalance(result.value);
                    setDecimals(result.decimals);
                }
            }
        })();
    }, [address, chainId, asset]);
    
    return (
        <>
            <tr className="hover:bg-gray-800">
                <td className="px-6 py-4 text-white text-md">{ asset }</td>
                <td className="px-6 py-4 text-white text-md">{ "-" }</td>
                <td className="px-6 py-4 text-white text-md">{ "-" }</td>
                <td className="px-6 py-4 flex justify-end space-x-2">
                    { chainId == 747 && <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, balance, ACTIONS.BORROW)}>
                        Borrow
                    </Button> }
                    { chainId != 747 && <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, balance, ACTIONS.REPAY)}>
                        Repay
                    </Button> }
                </td>
            </tr>
        </>
    )
}

export default BorrowTableRow;
