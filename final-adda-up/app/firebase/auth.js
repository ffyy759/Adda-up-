import { auth, db } from './config';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

export const registerUser = async (email, password, username) => {
  try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;
              await setDoc(doc(db, 'users', user.uid), {
                    uid: user.uid,
                          username: username,
                                email: email,
                                      bio: '',
                                            profilePic: '',
                                                  followers: [],
                                                        following: [],
                                                              coins: 50,
                                                                    rank: 'Navagat',
                                                                          badges: [],
                                                                                referralCode: user.uid.substring(0, 6).toUpperCase(),
                                                                                      createdAt: new Date().toISOString(),
                                                                                          });
                                                                                              return { success: true, user };
                                                                                                } catch (error) {
                                                                                                    return { success: false, error: error.message };
                                                                                                      }
                                                                                                      };

                                                                                                      export const loginUser = async (email, password) => {
                                                                                                        try {
                                                                                                            const userCredential = await signInWithEmailAndPassword(auth, email, password);
                                                                                                                return { success: true, user: userCredential.user };
                                                                                                                  } catch (error) {
                                                                                                                      return { success: false, error: error.message };
                                                                                                                        }
                                                                                                                        };

                                                                                                                        export const logoutUser = async () => {
                                                                                                                          try {
                                                                                                                              await signOut(auth);
                                                                                                                                  return { success: true };
                                                                                                                                    } catch (error) {
                                                                                                                                        return { success: false, error: error.message };
                                                                                                                                          }
                                                                                                                                          };