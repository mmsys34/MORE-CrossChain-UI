import { useEffect, useState } from "react";
import { useChainId, useAccount } from "wagmi";
import { Button } from "@headlessui/react";
import { ASSET_ADDRESS } from "../utils/address";
import { ACTIONS } from "../utils/constants";
import { CHAIN_IDS } from "../utils/chainid";
import { formatUnits, erc20Abi } from 'viem';
import { readContracts, getBalance } from '@wagmi/core';
import { config } from '../wagmi';

const SupplyTableRow = ({ asset, openModal } : {
    asset: string, openModal: (selectedAsset: string, decimals: number, balance: bigint, action: ACTIONS) => void
}) => {
    const chainId = useChainId();
    const { address, isConnected } = useAccount();
    const [ balance, setBalance ] = useState<bigint>(BigInt(0));
    const [ decimals, setDecimals ] = useState<number>(18);

    useEffect(() => {
        (async() => {
            if (address && chainId) {
                if (asset != "ETH" || chainId == CHAIN_IDS.FLOW_MAINNET) {
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
                <td className="px-6 py-4 text-white text-md">{ Number(formatUnits(balance, decimals)).toFixed(5) }</td>
                <td className="px-6 py-4 flex justify-end space-x-2">
                    <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, balance, ACTIONS.SUPPLY)}>
                        Supply
                    </Button>
                    <Button className="text-white px-3 py-2 border border-gray-600 hover:bg-gray-700" onClick={() => openModal(asset, decimals, balance, ACTIONS.WITHDRAW)}>
                        Withdraw
                    </Button>
                </td>
            </tr>
        </>
    )
}

export default SupplyTableRow;
