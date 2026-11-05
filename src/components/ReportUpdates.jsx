import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Text } from 'react-native';
import { api, demoMode } from '../services/api';
import { useErrorText, useSession } from '../session';
import { reportDate } from '../theme';
import { Body, Button, Card, Field, Notice, styles } from '../ui';

export function ReportUpdates({ report, canAdd, startOpen, onSaved }) {
  const [open, setOpen] = useState(startOpen && canAdd);
  const updates = report.updates || [];
  if (!updates.length && !canAdd) return null;

  return <Card>
    <Text style={styles.section}>Complementos do morador</Text>
    {updates.length ? [...updates].reverse().map((update) => <Card key={update.id}>
      <Body>Enviado em {reportDate(update.createdAt)}</Body>
      {!!update.note && <Body>{update.note}</Body>}
      {!!update.photoUrl && <Image source={{ uri: update.photoUrl }} accessibilityLabel="Foto do complemento"
        style={{ width: '100%', height: 170, borderRadius: 12 }} />}
    </Card>) : <Body>Fotos e novas informações serão registradas neste mesmo protocolo.</Body>}
    {canAdd && (open
      ? <UpdateForm id={report.id} onCancel={() => setOpen(false)} onSaved={() => { setOpen(false); onSaved(); }} />
      : <Button secondary title="Adicionar informação ou foto" icon="plus" onPress={() => setOpen(true)} />)}
  </Card>;
}

function UpdateForm({ id, onCancel, onSaved }) {
  const { session } = useSession();
  const errorText = useErrorText();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function choosePhoto() {
    setError('');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: demoMode });
      if (!picked.canceled) setPhoto(picked.assets[0]);
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  async function submit() {
    setError('');
    if (!note.trim() && !photo) {
      setError('Escreva uma atualização ou selecione uma foto.');
      return;
    }
    setBusy(true);
    try {
      await api.addReportUpdate(session, id, { note: note.trim(), photo });
      onSaved();
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <Field label="Nova informação" value={note} onChangeText={setNote} multiline maxLength={600} />
    {photo && <Image source={{ uri: photo.uri }} accessibilityLabel="Foto selecionada para o complemento"
      style={{ width: '100%', height: 150, borderRadius: 12 }} />}
    <Button secondary title={photo ? 'Trocar foto do complemento' : 'Selecionar foto do complemento'}
      icon="image" disabled={busy} onPress={choosePhoto} />
    {photo && <Button secondary title="Remover foto do complemento" disabled={busy} onPress={() => setPhoto(null)} />}
    <Notice error text={error} />
    <Button title="Enviar complemento" icon="send" busy={busy} onPress={submit} />
    <Button secondary title="Cancelar complemento" disabled={busy} onPress={onCancel} />
  </>;
}
