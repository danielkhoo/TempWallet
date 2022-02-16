import { Box, Flex, VStack, Text, Select, HStack, Button, Input, IconButton, useClipboard, useToast } from '@chakra-ui/react';
import { CopyIcon, CheckIcon } from '@chakra-ui/icons';
import type { NextPage } from 'next';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import QR from 'qrcode.react';
import styles from '../styles/Home.module.css';
import * as Bip39 from 'bip39';
import axios from 'axios';
import {
  Cluster,
  clusterApiUrl,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';

const WRAPPED_SOL_SPL_ADDRESS = 'So11111111111111111111111111111111111111112';
const DEVNET_USDC_SPL_PUBLIC_KEY = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const MAINNET_USDC_SPL_PUBLIC_KEY = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const USD_PER_SPL_USDC = 1000000; // USDC has 6 decimal places

const Home: NextPage = () => {
  // account and network
  const [account, setAccount] = useState<Keypair>();
  const [network, setNetwork] = useState<Cluster>('devnet');

  // balances
  const [solBalance, setSolBalance] = useState<number>(0);
  const [solPrice, setSolPrice] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);

  // ui state
  const address = account ? account.publicKey.toString() : '';
  const { hasCopied, onCopy } = useClipboard(address);
  const toast = useToast();

  const [solTransferTo, setSolTransferTo] = useState();
  const [solTransferAmount, setSolTransferAmount] = useState<number>(0);
  const [usdcTransferTo, setUsdcTransferTo] = useState();
  const [usdcTransferAmount, setUsdcTransferAmount] = useState<number>(0);

  const changeNetwork = (e: any) => {
    setNetwork(e.target.value);

    if (account) refreshBalances(account, e.target.value);
  };

  const refreshBalances = async (account: Keypair | null, network: Cluster) => {
    if (!account) return;

    try {
      const connection = new Connection(clusterApiUrl(network), 'confirmed');

      const publicKey = account.publicKey;

      const balance = await connection.getBalance(publicKey);
      setSolBalance(balance / LAMPORTS_PER_SOL);

      const res = await axios.get(`https://public-api.solscan.io/market/token/${WRAPPED_SOL_SPL_ADDRESS}`);
      if (res.status === 200) setSolPrice(Number(res.data.priceUsdt));

      console.log('sol balance', balance / LAMPORTS_PER_SOL);

      // usdc token account
      console.log('network', network);
      const usdcSPLTokenPublicKey = network === 'mainnet-beta' ? MAINNET_USDC_SPL_PUBLIC_KEY : DEVNET_USDC_SPL_PUBLIC_KEY;
      const tokenAccounts = await connection.getTokenAccountsByOwner(publicKey, { mint: usdcSPLTokenPublicKey });
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

  const transferSol = async () => {
    if (!account) return;
    if (!solTransferTo) return;
    if (solTransferAmount === 0) return;

    const connection = new Connection(clusterApiUrl(network), 'confirmed');
    const instructions = SystemProgram.transfer({
      fromPubkey: account.publicKey,
      toPubkey: new PublicKey(solTransferTo),
      lamports: solTransferAmount * LAMPORTS_PER_SOL,
    });
    const transaction = new Transaction().add(instructions);

    const signers = [{ publicKey: account.publicKey, secretKey: account.secretKey }];
    const txnSignature = await sendAndConfirmTransaction(connection, transaction, signers);

    refreshBalances(account, network);
    toast({
      position: 'top-right',
      title: 'Transfer Complete',
      description: `Sent ${solTransferAmount} SOL to ${solTransferTo}. Transaction: ${txnSignature}`,
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
  };

  const transferUsdc = async () => {
    if (!account) return;
    if (!usdcTransferTo) return;
    if (usdcTransferAmount === 0) return;

    const connection = new Connection(clusterApiUrl(network), 'confirmed');

    const toAccountPublicKey = new PublicKey(usdcTransferTo);

    const usdcSPLTokenPublicKey = network === 'mainnet-beta' ? MAINNET_USDC_SPL_PUBLIC_KEY : DEVNET_USDC_SPL_PUBLIC_KEY;
    const usdcSPLToken = new Token(connection, usdcSPLTokenPublicKey, TOKEN_PROGRAM_ID, account);

    const fromTokenAccount = await usdcSPLToken.getOrCreateAssociatedAccountInfo(account.publicKey);
    const toTokenAccount = await usdcSPLToken.getOrCreateAssociatedAccountInfo(toAccountPublicKey);

    const transaction = new Transaction().add(
      Token.createTransferInstruction(
        TOKEN_PROGRAM_ID,
        fromTokenAccount.address,
        toTokenAccount.address,
        account.publicKey,
        [],
        usdcTransferAmount * USD_PER_SPL_USDC
      )
    );

    const txnSignature = await sendAndConfirmTransaction(connection, transaction, [account]);

    refreshBalances(account, network);
    toast({
      position: 'top-right',
      title: 'Transfer Complete',
      description: `Sent ${usdcTransferAmount} USDC to ${usdcTransferTo}. Transaction: ${txnSignature}`,
      status: 'success',
      duration: 4000,
      isClosable: true,
    });
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

    refreshBalances(accountKeypair, network);
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
          </Select>
          <Text fontSize={'5xl'} fontWeight={'600'}>
            ${(solPrice * solBalance + usdcBalance).toFixed(2)}
          </Text>
          <QR
            level={'H'}
            includeMargin={false}
            value={address}
            size={380}
            fgColor="#4e4e4e"
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
              <Input mt={2} placeholder="To Address" onChange={(event: any) => setSolTransferTo(event.target.value)} />
              <Flex mt={2} dir="row" justifyContent="space-between">
                <Input placeholder="Amount" mr={4} type="number" onChange={(event: any) => setSolTransferAmount(event.target.value)} />
                <Button colorScheme="teal" width="150px" variant="outline" onClick={transferSol}>
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
              <Input mt={2} placeholder="To Address" onChange={(event: any) => setUsdcTransferTo(event.target.value)} />
              <Flex mt={2} dir="row" justifyContent="space-between">
                <Input placeholder="Amount" mr={4} type="number" onChange={(event: any) => setUsdcTransferAmount(event.target.value)} />
                <Button colorScheme="teal" width="150px" variant="outline" onClick={transferUsdc}>
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
export default Home;
