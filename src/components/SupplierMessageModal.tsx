/**
 * SupplierMessageModal
 * Modal wrapper for SupplierMessageForm
 * Easy integration into existing screens
 */

import React from 'react';
import { Modal, View, StyleSheet, SafeAreaView } from 'react-native';
import { DS } from '../theme/ds';
import { SupplierMessageForm } from './SupplierMessageForm';

interface SupplierMessageModalProps {
  visible: boolean;
  supplierId: string;
  supplierName: string;
  onClose: () => void;
  onSuccess?: () => void;
  autoLogOutbound?: boolean;
}

export function SupplierMessageModal({
  visible,
  supplierId,
  supplierName,
  onClose,
  onSuccess,
  autoLogOutbound = false,
}: SupplierMessageModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <SupplierMessageForm
            supplierId={supplierId}
            supplierName={supplierName}
            onClose={onClose}
            onSuccess={onSuccess}
            autoLogOutbound={autoLogOutbound}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
  },
  container: {
    flex: 1,
    backgroundColor: DS.bgCanvas,
  },
});
