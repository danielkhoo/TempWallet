import { Box, Flex, VStack, Text, Select, HStack, Button, Input, IconButton, useClipboard } from '@chakra-ui/react';
import { CopyIcon, CheckIcon } from '@chakra-ui/icons';
import type { NextPage } from 'next';
import Head from 'next/head';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import QR from 'qrcode.react';
import styles from '../styles/Home.module.css';
import * as Bip39 from 'bip39';
import axios from 'axios';
import { Cluster, clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

const WRAPPED_SOL_SPL_ADDRESS = 'So11111111111111111111111111111111111111112';
const DEVNET_USDC_SPL_PUBLIC_KEY = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MAINNET_USDC_SPL_PUBLIC_KEY = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const Home: NextPage = () => {
  const [account, setAccount] = useState<Keypair>();
  const [network, setNetwork] = useState<Cluster>('devnet');

  const [solBalance, setSolBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);

  const address = account ? account.publicKey.toString() : '';
  const { hasCopied, onCopy } = useClipboard(address);

  const changeNetwork = (e: any) => {
    setNetwork(e.target.value);
    if (account) refreshBalances(account);
  };

  const refreshBalances = async (account: Keypair | null) => {
    if (!account) return 0;

    try {
      const connection = new Connection(clusterApiUrl(network), 'confirmed');

      const publicKey = account.publicKey;

      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);

      const res = await axios.get(`https://public-api.solscan.io/market/token/${WRAPPED_SOL_SPL_ADDRESS}`);
      if (res.status === 200) setSolPrice(Number(res.data.priceUsdt));

      console.log('sol balance', balance / LAMPORTS_PER_SOL);

      // usdc token account
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, { mint: DEVNET_USDC_SPL_PUBLIC_KEY });
      console.log('tokenAccounts', tokenAccounts);

      console.log(tokenAccounts.value[0].pubkey);
      const usdcAmount = await connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
      console.log('usdc balance', usdcAmount.value.uiAmount);
      if (usdcAmount.value.uiAmount) setUsdcBalance(usdcAmount.value.uiAmount);
    } catch (error) {
      console.log('error', error);
      return 0;
    }
  };

  useEffect(() => {
    let mnemonic = localStorage.getItem('mnemonic');

    // On page load check if theres a mnemonic/keypair saved in local storage
    // if no, generate a mnemonic and save to local storage
    if (mnemonic === null) {
      mnemonic = Bip39.generateMnemonic();
      // Save to localstorage so that it persists across refreshes
      window.localStorage.setItem('mnemonic', mnemonic);
    }

    // convert the mnemonic to seed bytes https://github.com/bitcoinjs/bip39
    const seed = Bip39.mnemonicToSeedSync(mnemonic).slice(0, 32);

    // use the seed to generate a new account (i.e. a new keypair)
    // Documentation Reference:
    //   https://solana-labs.github.io/solana-web3.js/classes/Keypair.html
    //   https://solana-labs.github.io/solana-web3.js/classes/Keypair.html#fromSeed
    const accountKeypair = Keypair.fromSeed(seed);

    // // Update state with keypair
    setAccount(accountKeypair);

    refreshBalances(accountKeypair);
  }, []);

  return (
    <div className={styles.container}>
      <Head>
        <title>Burner Wallet</title>
        <meta name="description" content="Extremely hot burner wallet for Solana" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔥</text></svg>"
        />
      </Head>

      <Flex flexDir={'column'}>
        {/* <Flex flexDir={'row'} justifyContent={'space-between'}>
          <Text>TempWallet</Text>
          <Text>Wallet</Text>
        </Flex> */}
        <VStack mt={16} alignContent={'center'} justifyContent="center">
          <Select defaultValue={'devnet'} width="160px" height="36px" textAlign={'center'} onChange={changeNetwork}>
            <option value="mainnet-beta">mainnet-beta</option>
            <option value="devnet">devnet</option>
            <option value="testnet">testnet</option>
          </Select>
          <Text fontSize={'5xl'} fontWeight={'600'}>
            ${(solPrice * solBalance + usdcBalance).toFixed(2)}
          </Text>
          <QR
            level={'H'}
            includeMargin={false}
            value={address}
            size={380}
            imageSettings={{
              width: 90,
              height: 90,
              excavate: true,
              src: '/logo.svg',
            }}
          />
          <Text width="380px" fontSize="20px" textAlign="center">
            {address}
            <IconButton onClick={onCopy} aria-label="Search database" icon={hasCopied ? <CheckIcon /> : <CopyIcon />} variant="unstyled" size="xs" />
          </Text>

          <VStack>
            <Box width="380px" padding="1rem 2rem" borderRadius="lg">
              <Flex dir="row" justifyContent="space-between">
                <Text fontSize="28px" fontWeight="500">
                  {solBalance} SOL
                </Text>
                <Text fontSize="28px" fontWeight="500">
                  ${(solPrice * solBalance).toFixed(2)}
                </Text>
              </Flex>
              <Input mt={2} placeholder="To Address" />
              <Flex mt={2} dir="row" justifyContent="space-between">
                <Input placeholder="Amount" mr={4} />
                <Button colorScheme="teal" width="150px" variant="outline">
                  Transfer
                </Button>
              </Flex>
            </Box>
            <Box width="380px" padding="1rem 2rem" borderRadius="lg">
              <Flex dir="row" justifyContent="space-between">
                <Text fontSize="28px" fontWeight="500">
                  {usdcBalance} USDC
                </Text>
                <Text fontSize="28px" fontWeight="500">
                  ${usdcBalance.toFixed(2)}
                </Text>
              </Flex>
              <Input mt={2} placeholder="To Address" />
              <Flex mt={2} dir="row" justifyContent="space-between">
                <Input placeholder="Amount" mr={4} />
                <Button colorScheme="teal" width="150px" variant="outline">
                  Transfer
                </Button>
              </Flex>
            </Box>
          </VStack>
        </VStack>
      </Flex>
    </div>
  );
};
// min-height: 100vh;
// padding: 4rem 0;
// flex: 1;
// display: flex;
// flex-direction: column;
// justify-content: center;
// align-items: center;
export default Home;
